import { serveStatic } from 'hono/bun';
import { app } from './app.js';

// Produção (Bun, no container): o app + o front buildado em dist/, com
// fallback para o index.html (rotas do React Router).
app.use('/assets/*', serveStatic({ root: './dist' }));
app.use('*', serveStatic({ root: './dist' }));
app.get('*', serveStatic({ path: './dist/index.html' }));

const port = Number(process.env.PORT ?? 3000);
console.log(`crm no ar na porta ${port}`);

export default { port, fetch: app.fetch };
