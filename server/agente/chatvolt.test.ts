// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { agenteChatvolt, etapaParaFrente, motivoValido, tarefaDoHandoff, textoQualificacao } from './chatvolt';
import type { Etapa } from '../negocios/etapa';

const e = (id: string, name: string, position: number): Etapa => ({ id, name, position, funnel_id: 'f', sla_hours: null, webhook_url: null });
const funil = [
  e('novo', 'Novo Lead', 0),
  e('ia', 'Atendimento IA', 1),
  e('eng', 'Engajamento', 2),
  e('hum', 'Atendimento Humano', 3),
  e('demo', 'Demonstração', 4),
];

describe('etapaParaFrente', () => {
  it('Novo Lead → Atendimento IA', () => expect(etapaParaFrente(funil, 'novo', 'Atendimento IA')?.id).toBe('ia'));
  it('ignora acento e caixa', () => expect(etapaParaFrente(funil, 'ia', 'atendimento humano')?.id).toBe('hum'));
  it('nunca volta', () => expect(etapaParaFrente(funil, 'demo', 'Atendimento Humano')).toBeNull());
  it('não repete a atual', () => expect(etapaParaFrente(funil, 'ia', 'Atendimento IA')).toBeNull());
  it('nunca Engajamento', () => expect(etapaParaFrente(funil, 'novo', 'Engajamento')).toBeNull());
  it('etapa que não existe no funil', () => expect(etapaParaFrente(funil.filter((x) => x.id !== 'ia'), 'novo', 'Atendimento IA')).toBeNull());
});

describe('textoQualificacao', () => {
  it('resumo e só os campos preenchidos', () => {
    expect(textoQualificacao({ resumo: 'Buffet itinerante em Campinas', eventos_mes: 8, cidade: ' Campinas ', maior_dor: '' }))
      .toBe('Buffet itinerante em Campinas\nEventos por mês: 8\nCidade: Campinas');
  });
});

describe('handoff', () => {
  it('motivo desconhecido vira outro', () => {
    expect(motivoValido('Preço')).toBe('preco');
    expect(motivoValido('qualquer')).toBe('outro');
    expect(motivoValido(undefined)).toBe('outro');
  });
  it('títulos da tarefa', () => {
    expect(tarefaDoHandoff('demo', '', 'quinta', 'tarde')).toBe('Confirmar horário da demo: quinta, tarde');
    expect(tarefaDoHandoff('demo', '', '', '')).toBe('Confirmar horário da demo');
    expect(tarefaDoHandoff('preco', 'quer saber o valor do plano', '', '')).toBe('Assumir conversa no Chatvolt: quer saber o valor do plano');
    expect(tarefaDoHandoff('cliente', '', '', '')).toBe('Cliente da Oni no 0573: encaminhar ao suporte');
  });
});

describe('autenticação', () => {
  const env = { ...process.env };
  afterEach(() => { process.env = { ...env }; });
  const chamar = (auth?: string) => agenteChatvolt.request('/qualificacao', {
    method: 'POST', headers: { 'content-type': 'application/json', ...(auth ? { authorization: auth } : {}) }, body: '{}',
  });

  it('sem configuração: 503', async () => {
    delete process.env.CHATVOLT_AGENTE_TOKEN;
    delete process.env.CHATVOLT_AGENTE_ORG;
    expect((await chamar('Bearer x')).status).toBe(503);
  });
  it('token errado: 401', async () => {
    process.env.CHATVOLT_AGENTE_TOKEN = 'a'.repeat(40);
    process.env.CHATVOLT_AGENTE_ORG = '00000000-0000-0000-0000-000000000000';
    expect((await chamar('Bearer ' + 'b'.repeat(40))).status).toBe(401);
    expect((await chamar()).status).toBe(401);
  });
});
