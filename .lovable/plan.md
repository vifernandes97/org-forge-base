# Fase 2 de 4 — Telas de Negócio com Empresa, Segmento e Contatos

A partir desta fase, nenhuma tela lê ou grava nome, e-mail, telefone, empresa, razão social ou Instagram direto no negócio. Tudo passa por Empresa, Contatos e o vínculo negócio–contato. A ponte temporária continua só para webhook de entrada e importação (fase 3).

## Pontos de atenção (decididos no plano)

1. **Campo nome do negócio é obrigatório no banco.** Se as telas param de gravá-lo, criar um negócio falha. Migração pequena: valor padrão vazio para o nome (sem remover nada). A ponte não cria contato quando nome/e-mail/telefone vêm vazios, então não haverá contato duplicado.
2. **Exportação CSV** também passa a ler Empresa, Segmento e contatos pelas novas tabelas (mesmas colunas de hoje + Segmento e CNPJ), senão negócios novos sairiam sem empresa/contato.
3. **Webhook de saída (Automações)** continua lendo os campos antigos até a fase 3, que é quando as Edge Functions mudam. Negócios criados pelas telas a partir desta fase vão sair nesse webhook sem nome/e-mail/telefone/empresa. Se isso não for aceitável, a alternativa é trazer o ajuste do webhook de saída para esta fase.
4. A lista de testes do documento chegou cortada ("Testes ao final: criar"). Abaixo está a lista que vou executar; ajuste se quiser outra.

## 1. Camada de dados

- `services/companies.ts` + `hooks/useCompanies.ts`: buscar (nome fantasia, razão social, CNPJ, sem acento), criar, atualizar, obter com contatos e negócios, listar segmentos distintos da organização, mesclar empresas.
- `services/contacts.ts` + `hooks/useContacts.ts`: listar por empresa, criar, atualizar, excluir.
- `services/leadContacts.ts` (+ hooks): vincular, desvincular, definir principal (desmarca o anterior antes, respeitando "um principal por negócio").
- Select de negócios passa a trazer `company:companies(*)` e `lead_contacts(is_primary, contact:contacts(*))`; tipo `Lead`/`LeadWithRelations` ajustado.
- Busca de negócios (lista/kanban e busca de mesclagem): função SQL `search_lead_ids(org, termo)` que procura em nome fantasia, razão social, CNPJ (só dígitos) e em nome, e-mail e telefone (dígitos) de todos os contatos vinculados, ignorando acentos. O service filtra pelos ids retornados.
- Helper `getLeadDisplay(lead)` em `src/lib` → `{ title, segment, primaryContact }`, usado em todas as telas no lugar de "company_name || name".

## 2. Formulário de negócio

- **Empresa (obrigatória):** combobox com busca e "Criar nova empresa" (mesmo padrão do motivo de arquivamento). Criação pede Nome fantasia (obrigatório), Razão social, CNPJ, Instagram, Segmento.
- **Segmento:** combobox com segmentos da organização + criar novo.
- Aviso se o nome fantasia for igual (normalizado) a um segmento existente: "Isso parece um segmento, não o nome da empresa", com botão para mover o valor para Segmento.
- **CNPJ:** máscara 00.000.000/0000-00, grava só dígitos, valida dígitos verificadores; se já existe na organização, avisa e oferece usar a existente.
- **Contatos (opcional):** habilita após escolher empresa; lista contatos da empresa com caixa de seleção e escolha de principal; "Novo contato" (nome obrigatório, e-mail, telefone) cria na empresa e já marca. O primeiro marcado vira principal.

## 3. Detalhe do negócio

- **Bloco Empresa:** nome fantasia, segmento, razão social, CNPJ formatado, Instagram como link; edição inline gravando na empresa; aviso "Alterações valem para os N negócios desta empresa".
- **Trocar empresa** com confirmação; remove do negócio os contatos que não são da nova empresa.
- **Mesclar com outra empresa** (proprietário e administrador): escolher a absorvida, mostrar quantos negócios e contatos serão movidos, confirmar. Função SQL segura: verifica organização e papel, move negócios e contatos sem duplicar (e-mail; ou telefone com mesmo nome), preenche campos vazios, exclui a absorvida, registra atividade em cada negócio afetado.
- **Bloco Contatos:** badge Principal, telefone com link do WhatsApp, e-mail com mailto; ações definir principal, remover do negócio, editar; "Adicionar contato" escolhe um da empresa ainda não vinculado ou cria novo.
- **Outros negócios desta empresa:** funil, etapa e status, clicáveis (abre o negócio).
- Campos antigos Nome/E-mail/Telefone/Empresa/Razão social/Instagram saem do detalhe.

## 4. Exibição

- Cards do funil (KanbanCard, DragOverlayCard, LeadCard): título = nome fantasia; linha secundária = contato principal; segmento como badge discreto. WhatsApp usa o telefone do contato principal.
- Lista: colunas Empresa, Segmento, Razão social, CNPJ (oculta por padrão), Contato principal, E-mail, Telefone; ordenação por empresa, segmento e contato (no navegador, sobre a página carregada).
- Tarefas: nome fantasia da empresa do negócio.
- Mesclar negócios: rótulo nome fantasia + contato principal; mostra quantos contatos serão unidos.
- Filtros: novos filtros Segmento e Empresa (seleção múltipla, Empresa com busca), com chips na barra; filtros salvos antigos continuam abrindo, ignorando chaves que não existem mais.

## Fora desta fase

Edge Functions (webhook de entrada e de saída) e importação de planilha.

## Testes ao final (no navegador, logado)

1. Criar negócio com empresa nova (com CNPJ válido) e contato novo; conferir card, lista e detalhe.
2. Criar negócio escolhendo empresa existente e contato existente; CNPJ duplicado mostra aviso.
3. Nome fantasia igual a segmento mostra o aviso.
4. Editar empresa no detalhe e ver refletir em outro negócio da mesma empresa.
5. Adicionar segundo contato, trocar principal, remover contato.
6. Trocar empresa e confirmar remoção dos contatos de fora.
7. Mesclar duas empresas e conferir contagens e atividade registrada.
8. Busca por nome fantasia, CNPJ parcial, e-mail e final do telefone do contato, com e sem acento.
9. Filtros por Segmento e Empresa; abrir um filtro salvo antigo.
10. Exportar CSV e conferir empresa, segmento e contato.

## Detalhes técnicos

- Migrações: `ALTER TABLE leads ALTER COLUMN name SET DEFAULT ''`; funções `search_lead_ids(p_org uuid, p_term text)` (STABLE, SECURITY DEFINER, valida membro via `get_user_org_ids()`, usa `normalize_company_key`/unaccent e dígitos) e `merge_companies(p_target uuid, p_source uuid)` (SECURITY DEFINER, `search_path = public`, papel via `get_user_org_role` em owner/admin, reaproveita `find_company_contact`, move `leads.company_id`, relinka `lead_contacts` sem duplicar, insere `lead_activities` tipo `note`); EXECUTE revogado de PUBLIC/anon, concedido a authenticated.
- Mudar a empresa de um negócio pelo app grava `leads.company_id` direto; a ponte só age quando os campos antigos mudam, então não interfere.
- Filtros: `segments?: string[]` e `company_ids?: string[]` em `LeadFilters`; empresa no servidor via `.in('company_id', …)`, segmento via ids de empresas do segmento; `useLeadFilters` adiciona as chaves em ARRAY_KEYS e descarta chaves desconhecidas ao abrir filtros salvos.
- Zod: validador de CNPJ (dígitos verificadores) em `src/lib/cnpj.ts` com máscara e formatação.
