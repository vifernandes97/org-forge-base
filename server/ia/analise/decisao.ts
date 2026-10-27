import { z } from 'zod/v4';

// O que a IA devolve sobre um lote de mensagens. Sem campos opcionais (todos
// "nullable"): é o formato que a saída estrita de todos os provedores aceita.
// Limites (confiança 0–1, até 3 tarefas…) são conferidos depois, na política.

export const Decisao = z.strictObject({
  comercial: z.boolean().describe('Potencial cliente interessado em comprar (true); já cliente, pessoal, fornecedor, spam (false).'),
  lead_id: z.string().nullable().describe('Id de um dos negócios candidatos a que a conversa se refere, ou null.'),
  resumo: z.string().describe('1 a 3 frases com os fatos novos deste lote, em português. Vazio se não há nada relevante.'),
  mudar_etapa: z.strictObject({
    etapa_id: z.string().describe('Id da etapa de destino, da lista de etapas do funil do negócio.'),
    confianca: z.number().describe('0 a 1.'),
    motivo: z.string().describe('A evidência na conversa, em uma frase.'),
  }).nullable(),
  tarefas: z.array(z.strictObject({
    titulo: z.string(),
    descricao: z.string().nullable(),
    prazo_dias: z.number().int().describe('Dias a partir de hoje (0 = hoje).'),
    tipo: z.enum(['follow_up', 'call', 'email', 'meeting']),
  })).describe('Só compromissos concretos assumidos na conversa. No máximo 3.'),
  valor: z.strictObject({
    valor: z.number().describe('Valor do negócio em reais.'),
    confianca: z.number(),
    motivo: z.string(),
  }).nullable().describe('Só quando um valor do negócio foi cotado ou combinado explicitamente.'),
  novo_negocio: z.strictObject({
    empresa: z.string().nullable(),
    contato: z.string().nullable(),
    email: z.string().nullable(),
  }).nullable().describe('Quando não há negócio candidato e a conversa é comercial: o que a conversa diz sobre a empresa e o contato.'),
});

export type Decisao = z.infer<typeof Decisao>;
