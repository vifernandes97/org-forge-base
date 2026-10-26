import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import type { IncomingMessage, ServerResponse } from "http";
import { componentTagger } from "lovable-tagger";

// Em dev, /api/* e /rest/* vão para o mesmo app Hono da produção
// (server/app.ts), dentro do Vite: um processo só. O PostgREST roda à parte
// (infra/docker-compose.yml).
const PREFIXOS = ["/api/", "/rest/", "/health"];

async function paraRequest(req: IncomingMessage): Promise<Request> {
  const url = `http://${req.headers.host ?? "localhost"}${req.url}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
  }
  const temCorpo = req.method !== "GET" && req.method !== "HEAD";
  const chunks: Buffer[] = [];
  if (temCorpo) for await (const c of req) chunks.push(c as Buffer);
  return new Request(url, { method: req.method, headers, body: temCorpo ? Buffer.concat(chunks) : undefined });
}

async function devolver(res: ServerResponse, r: Response) {
  res.statusCode = r.status;
  r.headers.forEach((v, k) => {
    if (k !== "set-cookie") res.setHeader(k, v);
  });
  const cookies = r.headers.getSetCookie();
  if (cookies.length) res.setHeader("set-cookie", cookies);
  res.end(Buffer.from(await r.arrayBuffer()));
}

function apiEmDev(): Plugin {
  return {
    name: "api-em-dev",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        if (!PREFIXOS.some((p) => req.url?.startsWith(p))) return next();
        try {
          const { app } = await server.ssrLoadModule("/server/app.ts");
          await devolver(res, await app.fetch(await paraRequest(req)));
        } catch (e) {
          server.ssrFixStacktrace(e as Error);
          next(e);
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // O servidor lê process.env (como no container); o Vite só expõe VITE_*.
  for (const [k, v] of Object.entries(loadEnv(mode, process.cwd(), ""))) process.env[k] ??= v;

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [react(), apiEmDev(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
