import type { ChannelProvider } from '../nucleo/tipos.js';
import { evolution } from './evolution.js';

// Um provedor novo (ex.: API oficial da Meta) entra aqui e no check de
// channel_servers.provider / channel_connections.provider.
const PROVEDORES: Record<string, ChannelProvider> = { evolution };

export function provedor(nome: string): ChannelProvider {
  const p = PROVEDORES[nome];
  if (!p) throw new Error(`Provedor de canal desconhecido: ${nome}`);
  return p;
}

export const provedorExiste = (nome: string) => nome in PROVEDORES;
