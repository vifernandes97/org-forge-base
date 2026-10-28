import { randomBytes } from 'node:crypto';
import { servicePool } from '../db.js';
import { cifrar } from './cifra.js';
import { provedor } from './provedores/index.js';
import { servidor, urlDoWebhook } from './servidores.js';

// Liga/desliga a boas-vindas por áudio de uma conexão (docs/WHATSAPP.md §17).
// Roda dentro do container do crm-app (precisa do secrets.env):
//   sh -c 'set -a; . /app/secrets.env; set +a; bun server/canais/boas-vindas-config.ts <instância> <url-do-n8n> "<frase>"'
//   ... boas-vindas-config.ts <instância> off
// Gera um token novo a cada ligação e imprime uma vez: é o valor do cabeçalho
// X-CRM-Token na credencial Header Auth do webhook no n8n. Também reaplica o
// webhook da instância na Evolution (eventos atuais, com SEND_MESSAGE).

const [instancia, url, frase] = process.argv.slice(2);
if (!instancia || !url || (url !== 'off' && !frase)) {
  console.error('uso: boas-vindas-config.ts <instância> <url-do-n8n> "<frase>"  |  <instância> off');
  process.exit(1);
}

const pool = servicePool();
const { rows: [con] } = await pool.query<{ id: string; server_id: string; provider: string; webhook_token: string }>(
  `select id, server_id, provider, webhook_token from channel_connections where instance_name = $1`, [instancia]);
if (!con) {
  console.error(`instância ${instancia} não encontrada`);
  process.exit(1);
}

if (url === 'off') {
  await pool.query(`update channel_connections set welcome_webhook_url = null, welcome_secret = null, updated_at = now() where id = $1`, [con.id]);
  console.log('boas-vindas desligada');
} else {
  const token = randomBytes(24).toString('base64url');
  await pool.query(
    `update channel_connections set welcome_webhook_url = $2, welcome_trigger = $3, welcome_secret = $4, updated_at = now() where id = $1`,
    [con.id, url, frase, cifrar(token)]);
  console.log(`boas-vindas ligada → ${url}\nfrase: ${frase}\nX-CRM-Token: ${token}`);
}

await provedor(con.provider).setWebhook(await servidor(con.server_id), instancia, urlDoWebhook(con.provider, con.webhook_token));
console.log('webhook da Evolution reaplicado');
await pool.end();
