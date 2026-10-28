import { createHmac, timingSafeEqual } from 'node:crypto';

// Puro (sem banco), para o teste importar sem ambiente.
const TOLERANCIA_RETORNO_S = 300;

/** Confere `X-Orbi-Signature: sha256=<hex HMAC(segredo, "<timestamp>.<corpo>")>` e a idade do timestamp. */
export function assinaturaValida(segredo: string, timestamp: string | undefined, assinatura: string | undefined, corpo: string, agora = Date.now()) {
  if (!timestamp || !assinatura || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(agora / 1000 - Number(timestamp)) > TOLERANCIA_RETORNO_S) return false;
  const esperado = Buffer.from(`sha256=${createHmac('sha256', segredo).update(`${timestamp}.${corpo}`, 'utf8').digest('hex')}`);
  const recebido = Buffer.from(assinatura);
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}
