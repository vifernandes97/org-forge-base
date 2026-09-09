# Várias empresas na mesma conta (workspaces visíveis)

O sistema já separa totalmente os dados por empresa, mas a troca fica escondida e só aparece quando você já tem mais de uma. O plano deixa isso visível e permite criar novas empresas na hora.

## O que muda para você

1. **Seletor de empresa sempre visível**, no topo da barra lateral (onde hoje aparece só a inicial e o nome).
   - Mostra a empresa atual com a inicial colorida e o seu papel (Proprietário, Admin, Membro, Visualizador).
   - Ao clicar, lista todas as suas empresas com marcação na ativa, busca rápida quando houver mais de 6.
   - Aparece mesmo quando você tem só uma empresa.
2. **"Nova empresa" dentro do próprio seletor**: abre uma janela com Nome e Identificador (gerado automaticamente do nome, editável), valida se o identificador está livre, cria e já entra na nova empresa.
3. **Troca limpa**: ao trocar de empresa, os dados em tela são recarregados e você volta para o Painel, sem misturar informação da empresa anterior.
4. O seletor duplicado no cabeçalho é removido, para não haver dois lugares fazendo a mesma coisa.
5. A janela de criação também fica disponível em Configurações → Organização, como atalho.

Cada empresa continua com seus próprios negócios, funis, etapas, equipe, campos personalizados, automações e webhooks — nada é compartilhado entre elas.

## Detalhes técnicos

- Nenhuma mudança de banco: `organizations`, `organization_members` e o RPC `create_organization_with_owner` já cobrem tudo, e o RLS por `organization_id` garante o isolamento.
- Novo `src/components/layout/OrgSwitcher.tsx`: `DropdownMenu` com lista de `organizations` do `OrganizationContext`, item ativo com `Check`, filtro local por nome quando `organizations.length > 6`, e item "Nova empresa" que abre o diálogo.
- Novo `src/components/organizations/CreateOrganizationDialog.tsx`: reaproveita o schema zod/react-hook-form do `OnboardingPage` (nome + slug, auto-slug, `checkSlugAvailable`, `createOrganization`), depois `refetch()`, `setActiveOrg(novoId)` e `navigate('/dashboard')`.
- `AppSidebar.tsx`: substitui o bloco de cabeçalho estático pelo `OrgSwitcher`; no modo `collapsible=icon` mostra apenas a inicial como gatilho.
- `Header.tsx`: remove o dropdown de organizações (linhas do org switcher), mantém tema e menu do usuário.
- `OrganizationContext.tsx`: em `setActiveOrg`, além de gravar no `localStorage`, chamar `queryClient.clear()` (ou `invalidateQueries`) para descartar cache da empresa anterior; expõe também a lista de papéis já existente.
- Reutilizar o `role` do contexto para o rótulo do papel; sem novas queries.
