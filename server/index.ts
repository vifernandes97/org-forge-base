import { serveStatic } from 'hono/bun';
import { app } from './app.js';
import { iniciarFilaDeWebhooks } from './webhook-saida.js';

// Produção (Bun, no container): o app + o front buildado em dist/, com
// fallback para o index.html (rotas do React Router).
app.use('/assets/*', serveStatic({ root: './dist' }));
app.use('*', serveStatic({ root: './dist' }));
app.get('*', serveStatic({ path: './dist/index.html' }));

// Variável própria: o Easypanel injeta PORT=80 em todo app, e o domínio
// aponta para a 3000.
const port = Number(process.env.CRM_PORT ?? 3000);
console.log(`crm no ar na porta ${port}`);

// Só aqui (produção, processo único): no dev o Vite recarrega o módulo e
// duplicaria o intervalo.
iniciarFilaDeWebhooks();

export default { port, fetch: app.fetch };
