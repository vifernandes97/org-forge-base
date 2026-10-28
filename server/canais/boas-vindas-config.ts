import { randomBytes } from 'node:crypto';
import { servicePool } from '../db.js';
import { cifrar } from './cifra.js';
import { provedor } from './provedores/index.js';
import { servidor, urlDoWebhook } from './servidores.js';

// Liga/desliga a boas-vindas por áudio de uma conexão (docs/WHATSAPP.md §17).
// Roda dentro do container do crm-app (precisa do secrets.env):
//   sh -c 'set -a; . /app/secrets.env; set +a; bun server/canais/boas-vindas-config.ts <instância> token'
//   ... boas-vindas-config.ts <instância> <url-do-n8n> "<frase>"
//   ... boas-vindas-config.ts <instância> off
// token: gera um token novo (sem ligar o envio) e imprime uma vez — é o valor
// do cabeçalho X-CRM-Token na credencial Header Auth do webhook no n8n.
// <url>: liga o envio (gera o token só se ainda não há um). off: desliga e
// mantém o token. Todos reaplicam o webhook da instância na Evolution
// (eventos atuais, com SEND_MESSAGE).

const [instancia, url, frase] = process.argv.slice(2);
if (!instancia || !url || (!['off', 'token'].includes(url) && !frase)) {
  console.error('uso: boas-vindas-config.ts <instância> token  |  <instância> <url-do-n8n> "<frase>"  |  <instância> off');
  process.exit(1);
}

const pool = servicePool();
const { rows: [con] } = await pool.query<{ id: string; server_id: string; provider: string; webhook_token: string; welcome_secret: string | null }>(
  `select id, server_id, provider, webhook_token, welcome_secret from channel_connections where instance_name = $1`, [instancia]);
if (!con) {
  console.error(`instância ${instancia} não encontrada`);
  process.exit(1);
}

const novoToken = async () => {
  const token = randomBytes(24).toString('base64url');
  await pool.query(`update channel_connections set welcome_secret = $2, updated_at = now() where id = $1`, [con.id, cifrar(token)]);
  console.log(`X-CRM-Token: ${token}`);
};

if (url === 'off') {
  await pool.query(`update channel_connections set welcome_webhook_url = null, updated_at = now() where id = $1`, [con.id]);
  console.log('boas-vindas desligada');
} else if (url === 'token') {
  await novoToken();
} else {
  if (!con.welcome_secret) await novoToken();
  await pool.query(`update channel_connections set welcome_webhook_url = $2, welcome_trigger = $3, updated_at = now() where id = $1`, [con.id, url, frase]);
  console.log(`boas-vindas ligada → ${url}\nfrase: ${frase}`);
}

await provedor(con.provider).setWebhook(await servidor(con.server_id), instancia, urlDoWebhook(con.provider, con.webhook_token));
console.log('webhook da Evolution reaplicado');
await pool.end();
