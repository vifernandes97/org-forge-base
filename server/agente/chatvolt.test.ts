// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { agenteChatvolt, camposPersonalizados, etapaParaFrente, motivoValido, notaValida, pausarIaChatvolt, tarefaDoHandoff, telefoneComDdi, textoQualificacao, valorDoPlano } from './chatvolt';
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

describe('nota, campos e valor', () => {
  it('nota só de 1 a 5', () => {
    expect(notaValida(4)).toBe(4);
    expect(notaValida('3')).toBe(3);
    expect(notaValida('4,6')).toBe(5);
    expect(notaValida(0)).toBeNull();
    expect(notaValida(7)).toBeNull();
    expect(notaValida('alta')).toBeNull();
  });
  it('nota entra no texto da nota do CRM', () => {
    expect(textoQualificacao({ resumo: 'Buffet', pessoas: 5, nota: 4 })).toBe('Buffet\nPessoas que usariam: 5\nNota da Bia: 4 de 5');
  });
  it('campos personalizados do CRM', () => {
    expect(camposPersonalizados({ tipo_negocio: 'Buffet Infantil', eventos_mes: 12, cidade: '', maior_dor: 'orçamento demorado', resumo: 'x' }))
      .toEqual({ tipo_de_negocio: 'Buffet Infantil', media_de_festas: '12', dor_principal: 'orçamento demorado' });
  });
  it('genérico não sobrescreve campo', () => {
    expect(camposPersonalizados({ tipo_negocio: 'Outro', cidade: 'não informado', maior_dor: 'demora' })).toEqual({ dor_principal: 'demora' });
  });
  it('telefone ganha 55', () => {
    expect(telefoneComDdi('11 90000-0002')).toBe('5511900000002');
    expect(telefoneComDdi('+55 19 99937-0573')).toBe('5519999370573');
    expect(telefoneComDdi('1133334444')).toBe('551133334444');
  });
  it('valor só com plano escolhido', () => {
    expect(valorDoPlano('Pro', undefined)).toEqual({ plano: 'Pro', valor: 399 });
    expect(valorDoPlano('plano starter', '')).toEqual({ plano: 'Starter', valor: 199 });
    expect(valorDoPlano('Enterprise', 'R$ 1.299,00')).toEqual({ plano: 'Enterprise', valor: 1299 });
    expect(valorDoPlano('Pro', 'R$ 299,90')).toEqual({ plano: 'Pro', valor: 299.9 });
    expect(valorDoPlano('Pro', 5)).toEqual({ plano: 'Pro', valor: 399 });
    expect(valorDoPlano('', 399)).toBeNull();
    expect(valorDoPlano('ainda pensando', 399)).toBeNull();
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

describe('pausarIaChatvolt', () => {
  const env = { ...process.env };
  afterEach(() => { process.env = { ...env }; });
  const falso = (status = 200) => {
    const chamadas: { url: string; init: RequestInit }[] = [];
    const f = (async (url: string, init: RequestInit) => { chamadas.push({ url, init }); return new Response('{}', { status }); }) as unknown as typeof fetch;
    return { f, chamadas };
  };

  it('sem chave ou com id inválido não chama', async () => {
    delete process.env.CHATVOLT_API_KEY;
    const { f, chamadas } = falso();
    expect(await pausarIaChatvolt('cmwe4n4af00013w72pgm3ckbf', f)).toBe(false);
    process.env.CHATVOLT_API_KEY = 'k';
    expect(await pausarIaChatvolt('../x', f)).toBe(false);
    expect(chamadas).toHaveLength(0);
  });
  it('põe a conversa em HUMAN_REQUESTED', async () => {
    process.env.CHATVOLT_API_KEY = 'k';
    const { f, chamadas } = falso();
    expect(await pausarIaChatvolt('cmwe4n4af00013w72pgm3ckbf', f)).toBe(true);
    expect(chamadas[0].url).toBe('https://api.chatvolt.ai/conversations/cmwe4n4af00013w72pgm3ckbf/set-status');
    expect(JSON.parse(String(chamadas[0].init.body))).toEqual({ status: 'HUMAN_REQUESTED' });
    expect((chamadas[0].init.headers as Record<string, string>).authorization).toBe('Bearer k');
  });
  it('erro da API devolve false', async () => {
    process.env.CHATVOLT_API_KEY = 'k';
    expect(await pausarIaChatvolt('cmwe4n4af00013w72pgm3ckbf', falso(401).f)).toBe(false);
  });
});
