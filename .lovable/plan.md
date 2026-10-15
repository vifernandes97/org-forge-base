# Fase 2.5 — Segmentos como configuração do workspace

## Diagnóstico do campo personalizado (somente leitura, nada alterado)

Campos parecidos com "segmento / ramo / tipo":

| Workspace | Campo | Tipo | Opções | Preenchidos | Diferente do segmento da empresa ou empresa sem segmento |
|---|---|---|---|---|---|
| Oniplataforma | Tipo de negócio (tipo_de_negocio) | texto livre | — | 207 | 203 |
| ICS Logistics | Tipo de negócio (tipo_de_negocio) | seleção | Importador, Exportador | 42 | 42 |

Oniplataforma — valores: Buffet Infantil 69, Buffet Itinerante 57, Espaço de eventos 43, Produtora de eventos 24, Decoração / Fotografia 14. Os mesmos nomes dos segmentos confirmados, mas quase todas as divergências são empresas **sem segmento** (o campo está preenchido e a empresa, não).

10 exemplos (Oniplataforma): Du cora pizza park, Quintal Brincante, rosielebeschairadecampo, Hiper Boom Festas → Buffet Infantil; churrasgrill, Aquarela, Latete Buffet → Buffet Itinerante; Artiris, Fabio → Espaço de eventos; Bicho educa → Produtora de eventos. Todos com empresa sem segmento.

ICS Logistics: os valores gravados não batem com as opções (ex.: "Transporte de animais vivos", "Transporte Aéreo", "Múltiplos serviços", "其他的"); nenhuma empresa tem segmento.

Nada será migrado ou desativado nesse campo até sua confirmação. Sugestão para decidir depois: na Oniplataforma, preencher o segmento da empresa sem segmento a partir desse campo; na ICS, manter como está.

## 1. Banco
- Nova tabela de segmentos por workspace (nome, posição, ativo, datas), nome único pela chave normalizada; empresas ganham `segment_id` (bloqueia exclusão de segmento em uso) com índice.
- Migração: um segmento por valor distinto de `companies.segment` em cada workspace, ordem alfabética; preenche `segment_id`; `companies.segment` marcado deprecated, ninguém mais lê nem grava.
- Ponte de negócios (segmento conhecido no campo Empresa) passa a resolver pelo `segment_id`.
- Permissões no padrão dos motivos de arquivamento: leitura para membros, escrita só owner/admin.
- Funções: `add_company_segment` (reaproveita pela chave), `reorder_company_segments`, `merge_company_segments(origem, destino)` (move empresas e desativa origem).
- Workspaces novos começam sem segmentos.

## 2. Configurações → aba "Segmentos"
Ao lado de Motivos de Arquivamento: adicionar, renomear, arrastar para ordenar, ativar/desativar, contagem de empresas. Excluir só sem empresas; senão só desativar. "Mesclar segmento". Member/viewer só visualizam.

## 3. Telas
- Seletor de segmento (formulário, criação de empresa, detalhe): só ativos, na ordem configurada; segmento inativo da empresa aparece com selo "inativo". "Criar na hora" só owner/admin.
- Filtro por segmento usa `segment_id`; filtros salvos/links com o texto antigo são convertidos pelo nome normalizado.
- Aviso "Usar como segmento" no nome fantasia passa a consultar a tabela.
- Exportação, busca e webhook de saída (`company` e `company_data.segment`) leem o nome pela nova tabela; formato do envio não muda.

## 4. Teste (DDATA, funil "TESTE - não usar", webhook.site)
Criar segmento, renomear e ver no negócio e no payload; desativar (some do seletor, continua na empresa); mesclar dois segmentos; abrir filtro salvo antigo por texto; testar que member não cria. Apagar tudo ao final.

## Detalhes técnicos
- Tabela `company_segments` com unique index em `(organization_id, public.normalize_company_key(label))`, trigger `updated_at`, GRANTs + RLS via `get_user_org_role`.
- `fire-webhook`, `search_leads`, `leadsExport`, `leads.ts` (embed `company:companies(..., segment:company_segments(id,label,is_active))`) atualizados; ordenação por segmento via relação.
- Novos: `services/companySegments.ts`, hook, `SegmentsSettings.tsx`, `SegmentSelect.tsx`.
