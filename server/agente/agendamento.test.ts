import { describe, expect, it } from 'vitest';
import { escolherOpcoes, partesDoLink, periodoDe, rotuloDoHorario, type Horario } from './agendamento.js';
import { dataPedida } from './chatvolt.js';

// Segunda, 16/11/2026, 10h em São Paulo.
const agora = new Date('2026-11-16T13:00:00Z');
const sp = (dia: string, hora: string): Horario => {
  const start = new Date(`${dia}T${hora}:00-03:00`).toISOString();
  return { start, end: new Date(Date.parse(start) + 30 * 60_000).toISOString() };
};
const grade = (dias: string[], horas: string[]) => dias.flatMap((d) => horas.map((h) => sp(d, h)));
const horasDe = (hs: Horario[]) => hs.map((h) => new Date(h.start).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', hour: '2-digit', minute: '2-digit' }));

describe('link do tipo de reunião', () => {
  it('lê pessoa e tipo; outro formato é nulo', () => {
    expect(partesDoLink('https://orbi.neosoluti.com.br/agendar/vinicius/demo-oni/')).toEqual({ host: 'vinicius', type: 'demo-oni' });
    expect(partesDoLink('https://orbi.neosoluti.com.br/agendar/vinicius')).toBeNull();
    expect(partesDoLink(null)).toBeNull();
  });
});

describe('texto do horário', () => {
  it('hoje, amanhã e outros dias, com minutos só quando há', () => {
    expect(rotuloDoHorario(sp('2026-11-16', '14:00').start, agora)).toBe('hoje (segunda, 16/11) às 14h');
    expect(rotuloDoHorario(sp('2026-11-17', '09:30').start, agora)).toBe('amanhã (terça, 17/11) às 9h30');
    expect(rotuloDoHorario(sp('2026-11-19', '16:00').start, agora)).toBe('quinta, 19/11, às 16h');
  });
});

describe('dia e período pedidos pelo lead', () => {
  it('entende dia da semana, amanhã e data; o resto é nulo', () => {
    expect(dataPedida('quinta', agora)).toBe('2026-11-19');
    expect(dataPedida('amanhã', agora)).toBe('2026-11-17');
    expect(dataPedida('dia 20/11', agora)).toBe('2026-11-20');
    expect(dataPedida('qualquer dia', agora)).toBeNull();
    expect(periodoDe('de manhã')).toBe('manha');
    expect(periodoDe('Tarde')).toBe('tarde');
    expect(periodoDe('')).toBeNull();
  });
});

describe('escolher as opções', () => {
  const slots = grade(['2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20'], ['09:00', '10:00', '14:00', '16:00']);

  it('sem pedido: o primeiro dos três próximos dias e uma opção à tarde', () => {
    const r = escolherOpcoes(slots, {});
    expect(r.atendeuPedido).toBe(true);
    expect(horasDe(r.horarios)).toEqual(['17, 09:00', '17, 14:00', '18, 09:00', '19, 09:00']);
  });

  it('com dia: espalhados nesse dia', () => {
    const r = escolherOpcoes(slots, { data: '2026-11-19' }, 3);
    expect(r.atendeuPedido).toBe(true);
    expect(horasDe(r.horarios)).toEqual(['19, 09:00', '19, 14:00', '19, 16:00']);
  });

  it('com período: só nele', () => {
    const r = escolherOpcoes(slots, { periodo: 'tarde' }, 3);
    expect(horasDe(r.horarios)).toEqual(['17, 14:00', '18, 14:00', '19, 14:00']);
  });

  it('dia sem horário: cai para os próximos e avisa', () => {
    const r = escolherOpcoes(slots, { data: '2026-11-21' }, 2);
    expect(r.atendeuPedido).toBe(false);
    expect(r.horarios).toHaveLength(2);
  });

  it('nada livre: vazio', () => {
    expect(escolherOpcoes([], {}).horarios).toEqual([]);
  });
});

describe('ficha do lead na demo', () => {
  it('só os campos preenchidos, resumo e link no fim', async () => {
    const { linhasDaFicha } = await import('./chatvolt.js');
    const f = linhasDaFicha({
      empresa: 'Buffet Alegria', segmento: 'Buffet Infantil', cidade: 'Campinas', festas: '12', pessoas: '3', controle: 'planilha',
      dor: 'contratos', objecao: '', nota: 4, valor: 199, etapa: 'Atendimento Humano', origem: 'formulário · meta / cpc',
      resumo: 'Quer parar de perder festa.', link: 'https://crm/?lead=1',
    });
    expect(f).toBe([
      'Empresa: Buffet Alegria', 'Segmento: Buffet Infantil', 'Cidade: Campinas', 'Festas por mês: 12', 'Pessoas que usariam: 3',
      'Controla hoje com: planilha', 'Dor principal: contratos', 'Nota: 4 de 5', 'Valor: R$ 199/mês', 'Etapa: Atendimento Humano',
      'Origem: formulário · meta / cpc', '', 'Resumo da Bia: Quer parar de perder festa.', '', 'Negócio no CRM: https://crm/?lead=1',
    ].join('\n'));
    expect(linhasDaFicha({ link: 'x' })).toBe('Negócio no CRM: x');
  });
});
