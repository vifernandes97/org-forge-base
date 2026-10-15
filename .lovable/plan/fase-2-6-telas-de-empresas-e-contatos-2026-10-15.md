# Fase 2.6 — Telas de Empresas e Contatos

Segue o mesmo visual e comportamento da tela de Negócios: lista com escolha de colunas, barra de filtros, paginação e ordenação no servidor, exportação CSV, cartões no celular e detalhe em painel lateral.

## 1. Menu lateral
- Ordem: Dashboard, Negócios (ícone Handshake), Empresas (Building2), Contatos (Contact), Tarefas, depois Funis, Automações e Configurações como hoje.
- Páginas protegidas: /companies, /companies/:id, /contacts.

## 2. Dados
- **Visão de empresas** (respeita as permissões de cada usuário): dados da empresa, nome do segmento, contatos, negócios abertos e total, valor em aberto, data do último negócio e da última atividade.
- **Visão de contatos** (mesma regra): dados do contato, nome fantasia e segmento da empresa, negócios vinculados, em quantos é principal, se está em algum negócio ativo.
- Definições:
  - Negócio aberto = status "aberto", não arquivado e não mesclado. Negócios mesclados não entram em nenhuma contagem.
  - Valor em aberto = soma do valor dos negócios abertos.
  - Última atividade = registro mais recente da linha do tempo de qualquer negócio da empresa.
- Busca, filtros, ordenação e paginação rodam no servidor, por uma consulta por tela que recebe os filtros e devolve a página e o total. A busca ignora acentos e maiúsculas, como em Negócios.
- Filtros ficam no endereço da página para compartilhar o link. Nenhuma lista de ids vai no endereço; a empresa filtrada em Contatos vai como um único id.

## 3. Empresas (/companies)
- Colunas: Nome fantasia, Segmento, Razão social, CNPJ formatado, Instagram, Contatos, Negócios abertos / total, Valor em aberto, Última atividade, Criada em. Todas ordenáveis e com escolha de colunas visíveis.
- Ordenação por Segmento igual à de Negócios: posição configurada, depois nome fantasia, sem segmento por último.
- Filtros:
  - Busca: nome fantasia, razão social, CNPJ, e nome, e-mail e telefone dos contatos.
  - Segmento: vários, com a opção "Sem segmento".
  - Situação: com negócio aberto, sem negócio aberto ou sem nenhum negócio.
  - Responsável e Funil: a empresa tem ao menos um negócio não mesclado com esse responsável ou nesse funil.
  - Sem contato.
  - Data de criação (intervalo).
- Ações: Nova empresa (mesmo cadastro do formulário de negócio, com CNPJ validado e aviso de duplicado) e exportar CSV com os filtros.
- Em massa:
  - Alterar segmento.
  - Mesclar, com exatamente 2 selecionadas, pela função de mesclagem que já existe (bloqueia CNPJ diferente).
  - Excluir: só empresas sem negócios, com confirmação. As que têm negócio ficam de fora e são listadas.

## 4. Detalhe da empresa (/companies/:id)
- Cabeçalho editável (mesmo bloco do detalhe do negócio), segmento e botões Mesclar e Excluir. Excluir só aparece sem negócios.
- Aba Negócios: funil, etapa, status, valor e responsável. Clicar abre o detalhe do negócio. "Novo negócio" já vem com a empresa preenchida.
- Aba Contatos: criar, editar e excluir (com a confirmação atual que lista os negócios). Cada contato mostra em quais negócios está.
- Aba Atividades: linha do tempo de todos os negócios da empresa, indicando de qual negócio é cada registro. Só leitura; para registrar uma atividade, abre-se o negócio.

## 5. Contatos (/contacts)
- Colunas: Nome, Empresa (link), Segmento da empresa, E-mail (mailto), Telefone (link do WhatsApp), Negócios vinculados, Principal em, Criado em.
- Filtros:
  - Busca: nome, e-mail e telefone.
  - Empresa: com busca.
  - Segmento.
  - E-mail e telefone: com, sem ou tanto faz, cada um.
  - Em negócio ativo: sim ou não.
  - Data de criação.
- Ações: Novo contato (empresa obrigatória) e exportar CSV com os filtros.
- Em massa:
  - Mesclar exatamente 2 contatos da mesma empresa. Você escolhe qual fica. Os vínculos com negócios passam para ele sem duplicar, os campos vazios são preenchidos e, se o outro era o principal de algum negócio, o que fica passa a ser o principal.
  - Excluir, com a confirmação que lista os negócios.
- Clicar no contato abre o painel lateral com os dados editáveis e os negócios dele, ligado ao endereço (?contact=id) para compartilhar.

## 6. Permissões
Iguais às do banco: quem só visualiza não cria nem edita; membro cria e edita; excluir e mesclar só dono e admin. Botões não permitidos ficam ocultos.

## 7. Testes (DDATA, dados apagados no final)
- Navegar pelo menu nas duas telas.
- Filtrar empresas por segmento e por "sem negócio aberto".
- Ordenar por valor em aberto.
- Buscar uma empresa pelo e-mail de um contato.
- Abrir a empresa, criar um negócio já com ela preenchida e ver a linha do tempo agregada.
- Filtrar contatos por empresa e por "sem telefone".
- Mesclar 2 contatos da mesma empresa e conferir os negócios.
- Exportar CSV das duas telas com filtro.
- Conferir no celular.
- Abrir um link compartilhado com filtros e outro com ?contact=.

## Pontos para confirmar
1. **Excluir empresa sem negócios que tem contatos:** proponho excluir os contatos junto, com a confirmação mostrando quantos são. A alternativa é bloquear até os contatos serem removidos.
2. **Mesclar empresas** passa a ser permitido só para dono e admin, como no item 6. Hoje o detalhe do negócio também permite para membro; vou alinhar lá também.

## Detalhes técnicos
- Migração:
  - Views `companies_overview` e `contacts_overview` com `security_invoker = true`, com GRANT de SELECT para authenticated.
  - Funções `list_companies(p_org, p_filters jsonb, p_sort, p_dir, p_page, p_page_size)` e `list_contacts(...)`, SECURITY INVOKER, que devolvem linhas mais `total_count`. A busca usa `normalize_company_key`; responsável, funil e contatos entram por EXISTS. A exportação usa a mesma função sem limite de página.
  - `merge_contacts(p_keep, p_remove)` SECURITY DEFINER, search_path=public: mesma organização e mesma empresa, papel owner/admin, move `lead_contacts` sem duplicar, preserva `is_primary`, preenche campos vazios, apaga o removido e registra na linha do tempo dos negócios afetados.
  - EXECUTE revogado de PUBLIC/anon.
- Front:
  - `src/pages/CompaniesPage.tsx`, `CompanyDetailPage.tsx` e `ContactsPage.tsx`.
  - Componentes em `src/components/companies/` e `src/components/contacts/`.
  - Hooks de filtros na URL no padrão de `useLeadFilters`.
  - `ContactSheet` controlado por `?contact=`.
  - O formulário de negócio aceita uma empresa inicial.
  - Ajustes em AppSidebar e App.tsx.
