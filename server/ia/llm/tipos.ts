import type { z } from 'zod/v4';
import type { Credencial } from '../credenciais.js';

// Uma chamada de "analise e devolva JSON neste schema", igual para todos os
// provedores. Cada provedor (anthropic.ts, openai.ts, google.ts) traduz para
// a API dele; o resto do orquestrador não sabe qual está rodando.

export interface ModeloInfo {
  id: string;
  nome: string;
  /** Aceita imagem. Nulo quando o provedor não informa. */
  visao: boolean | null;
  /** Garante saída no schema. Nulo quando o provedor não informa. */
  estruturada: boolean | null;
  contexto: number | null;
}

export interface Imagem {
  mimetype: string;
  base64: string;
}

export interface PedidoAnalise<T> {
  /** Estável por organização (regras, etapas, instruções): vai em cache onde há. */
  sistema: string;
  /** O que muda a cada chamada (negócio, mensagens). */
  usuario: string;
  imagens: Imagem[];
  schema: z.ZodType<T>;
  nomeSchema: string;
}

export interface RespostaAnalise<T> {
  objeto: T;
  modelo: string;
  tokensEntrada: number | null;
  tokensSaida: number | null;
}

/** O provedor recusou o conteúdo (não adianta tentar de novo igual). */
export class RecusaDoModelo extends Error {}

export interface ProvedorLlm {
  listarModelos(cred: Credencial): Promise<ModeloInfo[]>;
  analisar<T>(cred: Credencial, modelo: string, pedido: PedidoAnalise<T>): Promise<RespostaAnalise<T>>;
}
