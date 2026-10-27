import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { app } from './app.js';
import { iniciarFilaDeWebhooks } from './webhook-saida.js';
import { papelAtual, pararFila } from './canais/fila.js';
import { iniciarWorker } from './worker.js';

// Produção (Bun, no container). ROLE escolhe o papel do processo:
//   all (padrão, um container só): HTTP + worker dos canais
//   api: só HTTP (o webhook do WhatsApp só grava e enfileira)
//   worker: só os jobs (escala com mais réplicas); HTTP só com /health
const papel = papelAtual();

// Variável própria: o Easypanel injeta PORT=80 em todo app, e o domínio
// aponta para a 3000.
const port = Number(process.env.CRM_PORT ?? 3000);

let servidorHttp: Hono = app;
if (papel === 'worker') {
  servidorHttp = new Hono();
  servidorHttp.get('/health', (c) => c.json({ ok: true, role: papel, commit: process.env.GIT_SHA ?? null }));
} else {
  // O app + o front buildado em dist/, com fallback para o index.html (rotas do React Router).
  app.use('/assets/*', serveStatic({ root: './dist' }));
  app.use('*', serveStatic({ root: './dist' }));
  app.get('*', serveStatic({ path: './dist/index.html' }));
  // Só aqui (produção, processo único): no dev o Vite recarrega o módulo e
  // duplicaria o intervalo. A fila de saída fica com a API (ainda é um intervalo simples).
  iniciarFilaDeWebhooks();
}

if (papel !== 'api') {
  iniciarWorker().catch((e) => {
    console.error('[worker] não subiu', e);
    process.exit(1);
  });
}

for (const sinal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sinal, () => {
    pararFila().finally(() => process.exit(0));
  });
}

console.log(`crm no ar na porta ${port} (ROLE=${papel})`);

export default { port, fetch: servidorHttp.fetch };
