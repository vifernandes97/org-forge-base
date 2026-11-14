// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { agenteChatvolt, camposPersonalizados, etapaParaFrente, motivoValido, notaValida, pausarIaChatvolt, noPerfilIdeal, notaDoLead, enviarVariaveisChatvolt, quantasPessoas, usaSistema, dorForte, planoIndicado, emailValido, horarioDaDemo, tarefaDoHandoff, telefoneComDdi, telefoneDoLead, textoQualificacao, valorDoPlano } from './chatvolt';
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

describe('telefoneDoLead', () => {
  const conversa = (corpo: object, status = 200) => {
    const urls: string[] = [];
    const f = (async (url: string) => { urls.push(url); return new Response(JSON.stringify(corpo), { status }); }) as unknown as typeof fetch;
    return { f, urls };
  };
  afterEach(() => { delete process.env.CHATVOLT_API_KEY; });

  it('usa o telefone do corpo quando vem com dígitos', async () => {
    process.env.CHATVOLT_API_KEY = 'k';
    const { f, urls } = conversa({});
    expect(await telefoneDoLead({ telefone: '11987654321', conversa_id: 'cmweszbnv01ra1dqp2oea3734' }, f)).toBe('11987654321');
    expect(urls).toHaveLength(0);
  });

  it('placeholder não substituído busca pela conversa', async () => {
    process.env.CHATVOLT_API_KEY = 'k';
    const { f, urls } = conversa({ participantsContacts: [{ phoneNumber: '+55 11 98765-4321' }] });
    expect(await telefoneDoLead({ telefone: '{user-phone-number}', conversa_id: 'cmweszbnv01ra1dqp2oea3734' }, f)).toBe('5511987654321');
    expect(urls[0]).toBe('https://api.chatvolt.ai/conversations/cmweszbnv01ra1dqp2oea3734');
  });

  it('erro na API devolve o que veio', async () => {
    process.env.CHATVOLT_API_KEY = 'k';
    const { f } = conversa({}, 500);
    expect(await telefoneDoLead({ telefone: '{user-phone-number}', conversa_id: 'cmweszbnv01ra1dqp2oea3734' }, f)).toBe('{user-phone-number}');
  });
});

describe('valor indicado e horário da demo', () => {
  it('lê o plano indicado em planos_informados', () => {
    expect(planoIndicado('Starter R$ 199; indicado Starter')).toEqual({ plano: 'Starter', valor: 199 });
    expect(planoIndicado('Starter R$ 199, Pro R$ 399; indicado: Pro')).toEqual({ plano: 'Pro', valor: 399 });
    expect(planoIndicado('Pro por R$ 299 na Black Friday')).toEqual({ plano: 'Pro', valor: 299 });
    expect(planoIndicado('Starter R$ 199 e Pro R$ 399')).toBeNull();
    expect(planoIndicado('Starter R$ 199 pro casal')).toEqual({ plano: 'Starter', valor: 199 });
    expect(planoIndicado('Buffet do casal, usam caderno. Indicado plano Starter R$199. Demo pela manhã.')).toEqual({ plano: 'Starter', valor: 199 });
    expect(planoIndicado('')).toBeNull();
  });
  // 13/11/2026 é sexta; 17h em São Paulo = 20h UTC.
  const sexta17h = new Date('2026-11-13T20:00:00Z');
  it('sem dia: próximo dia útil, hora pelo período', () => {
    expect(horarioDaDemo('', 'manhã', sexta17h)).toEqual({ data: '2026-11-16', hora: '10:00' });
    expect(horarioDaDemo('a definir', 'tarde', sexta17h)).toEqual({ data: '2026-11-16', hora: '14:00' });
  });
  it('dia da semana, data e hora explícita', () => {
    expect(horarioDaDemo('quinta', 'manhã', sexta17h)).toEqual({ data: '2026-11-19', hora: '10:00' });
    expect(horarioDaDemo('segunda às 15h', '', sexta17h)).toEqual({ data: '2026-11-16', hora: '15:00' });
    expect(horarioDaDemo('20/11', 'tarde', sexta17h)).toEqual({ data: '2026-11-20', hora: '14:00' });
    expect(horarioDaDemo('hoje', 'manhã', sexta17h)).toEqual({ data: '2026-11-16', hora: '10:00' });
    expect(horarioDaDemo('amanhã', 'manhã', sexta17h)).toEqual({ data: '2026-11-14', hora: '10:00' });
  });
});

describe('e-mail do lead', () => {
  it('aceita e-mail válido e normaliza', () => {
    expect(emailValido(' Fulano@Buffet.com.br ')).toBe('fulano@buffet.com.br');
    expect(emailValido('fulano@buffet')).toBe('');
    expect(emailValido('não tenho')).toBe('');
    expect(emailValido(undefined)).toBe('');
  });
});

describe('PCI', () => {
  it('buffet infantil e espaço de eventos estão no PCI; o resto não', () => {
    expect(noPerfilIdeal('Buffet Infantil')).toBe(true);
    expect(noPerfilIdeal('Espaço de eventos')).toBe(true);
    expect(noPerfilIdeal('Buffet Itinerante')).toBe(false);
    expect(noPerfilIdeal('Casamento / Corporativo')).toBe(false);
    expect(noPerfilIdeal('Decoração / Fotografia')).toBe(false);
    expect(noPerfilIdeal('Produtora de eventos')).toBe(false);
    expect(noPerfilIdeal('buffet')).toBeNull();
    expect(noPerfilIdeal('')).toBeNull();
  });
  it('tarefa do vendedor', () => {
    expect(tarefaDoHandoff('vendedor', 'buffet itinerante', '', '')).toBe('Lead fora do PCI: vendedor qualifica antes da demo: buffet itinerante');
    expect(motivoValido('vendedor')).toBe('vendedor');
  });
});

describe('nota pelos critérios da Oni', () => {
  it('lê quantas pessoas', () => {
    expect(quantasPessoas('2 pessoas por enquanto.')).toBe(2);
    expect(quantasPessoas('duas')).toBe(2);
    expect(quantasPessoas('só eu')).toBe(1);
    expect(quantasPessoas('eu e minha esposa')).toBe(2);
    expect(quantasPessoas('')).toBeNull();
  });
  it('usa ou já usou sistema', () => {
    expect(usaSistema('outro sistema, insatisfeito')).toBe(true);
    expect(usaSistema('planilha e caderno')).toBe(false);
    expect(usaSistema('nenhum sistema, tudo no WhatsApp')).toBe(false);
    expect(usaSistema('já usei um app de agenda')).toBe(true);
  });
  it('dor principal forte ou fraca', () => {
    expect(dorForte('financeiro')).toBe(false);
    expect(dorForte('estoque e precificação')).toBe(false);
    expect(dorForte('financeiro e orçamento')).toBe(false);
    expect(dorForte('Orçamento demorado e falta de controle financeiro')).toBe(true);
    expect(dorForte('agenda')).toBe(true);
    expect(dorForte('')).toBeNull();
  });
  it('PCI começa em 3 e sobe com os critérios', () => {
    expect(notaDoLead({ tipo: 'Buffet Infantil' })).toBe(3);
    expect(notaDoLead({ tipo: 'Buffet Infantil', pessoas: '1', controle: 'planilha', dor: 'financeiro' })).toBe(3);
    expect(notaDoLead({ tipo: 'Espaço de eventos', pessoas: '2', controle: 'planilha', dor: 'financeiro' })).toBe(4);
    expect(notaDoLead({ tipo: 'Buffet Infantil', pessoas: '3', controle: 'outro sistema', dor: 'orçamento' })).toBe(5);
  });
  it('fora do PCI começa menor', () => {
    expect(notaDoLead({ tipo: 'Buffet itinerante' })).toBe(1);
    expect(notaDoLead({ tipo: 'Buffet itinerante', pessoas: '4', controle: 'sistema', dor: 'agenda' })).toBe(4);
    expect(notaDoLead({ tipo: 'buffet', pessoas: '2' })).toBe(3);
  });
});

describe('variáveis no Chatvolt', () => {
  const antes = process.env.CHATVOLT_API_KEY;
  afterEach(() => { process.env.CHATVOLT_API_KEY = antes; });
  it('manda só o que mudou e para no primeiro erro', async () => {
    process.env.CHATVOLT_API_KEY = 'chave';
    const corpos: { key: string; value: string; id: string }[] = [];
    const ok = (async (_u: string, init: RequestInit) => { corpos.push(JSON.parse(String(init.body))); return new Response('{}'); }) as unknown as typeof fetch;
    expect(await enviarVariaveisChatvolt('cmconversa123', { segmento: 'Buffet Infantil', cidade: '', nota_crm: '3 de 5' }, ok)).toBe(2);
    expect(corpos.map((c) => c.key)).toEqual(['segmento', 'nota_crm']);
    expect(corpos[0].id).toBe('cmconversa123');
    expect(await enviarVariaveisChatvolt('cmconversa123', { segmento: 'Buffet Infantil', nota_crm: '4 de 5' }, ok)).toBe(1);
    const erro = (async () => new Response('x', { status: 404 })) as unknown as typeof fetch;
    expect(await enviarVariaveisChatvolt('cmconversa456', { a: '1', b: '2' }, erro)).toBe(0);
  });
  it('sem chave ou id inválido não chama', async () => {
    process.env.CHATVOLT_API_KEY = '';
    expect(await enviarVariaveisChatvolt('cmconversa789', { a: '1' })).toBe(0);
  });
});
