import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Em dev, /api/* roda as mesmas Functions da Vercel (pasta api/) dentro do
// Vite: um processo só, sem a CLI da Vercel. Em produção, quem serve é a Vercel.
const ROTAS: Array<[prefixo: string, arquivo: string]> = [["/api/auth/", "/api/auth.ts"]];

function apiEmDev(): Plugin {
  return {
    name: "api-em-dev",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const rota = ROTAS.find(([prefixo]) => req.url?.startsWith(prefixo));
        if (!rota) return next();
        try {
          const mod = await server.ssrLoadModule(rota[1]);
          await mod.default(req, res);
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
  // As Functions leem process.env (como na Vercel); o Vite só expõe VITE_*.
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
