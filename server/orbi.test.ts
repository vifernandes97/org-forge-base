// @vitest-environment node
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { assinaturaValida } from './orbi-assinatura.js';

const segredo = 'orbi_whsec_teste';
const assinar = (ts: number, corpo: string) =>
  `sha256=${createHmac('sha256', segredo).update(`${ts}.${corpo}`, 'utf8').digest('hex')}`;

describe('assinaturaValida (retorno do Orbi)', () => {
  const agora = 1_800_000_000_000;
  const ts = agora / 1000;
  const corpo = '{"event":"request.accepted","externalId":"x"}';

  it('aceita a assinatura do formato do Orbi', () => {
    expect(assinaturaValida(segredo, String(ts), assinar(ts, corpo), corpo, agora)).toBe(true);
  });
  it('recusa corpo alterado', () => {
    expect(assinaturaValida(segredo, String(ts), assinar(ts, corpo), corpo.replace('x', 'y'), agora)).toBe(false);
  });
  it('recusa outro segredo', () => {
    const outra = `sha256=${createHmac('sha256', 'outro').update(`${ts}.${corpo}`).digest('hex')}`;
    expect(assinaturaValida(segredo, String(ts), outra, corpo, agora)).toBe(false);
  });
  it('recusa timestamp com mais de 5 minutos', () => {
    const velho = ts - 301;
    expect(assinaturaValida(segredo, String(velho), assinar(velho, corpo), corpo, agora)).toBe(false);
  });
  it('recusa sem cabeçalhos', () => {
    expect(assinaturaValida(segredo, undefined, undefined, corpo, agora)).toBe(false);
  });
});
