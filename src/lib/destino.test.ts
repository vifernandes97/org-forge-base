import { describe, expect, it } from 'vitest';
import { destinoSeguro } from './destino';

describe('destinoSeguro', () => {
  it('mantém caminho interno com o lead', () => {
    expect(destinoSeguro('/dashboard?lead=abc')).toBe('/dashboard?lead=abc');
  });
  it('recusa URL externa e protocolo relativo', () => {
    expect(destinoSeguro('https://evil.com')).toBe('/dashboard');
    expect(destinoSeguro('//evil.com')).toBe('/dashboard');
    expect(destinoSeguro('/\\evil.com')).toBe('/dashboard');
  });
  it('sem next ou apontando para o login cai no dashboard', () => {
    expect(destinoSeguro(null)).toBe('/dashboard');
    expect(destinoSeguro('/login?next=x')).toBe('/dashboard');
  });
});
