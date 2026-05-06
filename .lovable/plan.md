
# Convite por link com auto-aceite

O fluxo "Adicionar membro" atual exige que o convidado já tenha conta — daí o erro "Usuário não encontrado". A funcionalidade que você quer **já existe** parcialmente como "Gerar link de convite", mas vou:

1. **Remover o formulário "Adicionar membro"** (legado e confuso) da `TeamPage`.
2. **Promover "Convidar novo membro"** como o fluxo principal: um card explicativo com botão "Gerar link de convite".
3. **Auto-aceitar o convite** quando o convidado chegar ao `/invite/:token` já autenticado (após cadastro), sem precisar clicar de novo em "Aceitar".
4. **Confirmação de e-mail**: o cadastro atual exige verificar e-mail antes do login. Para o link funcionar de ponta a ponta sem fricção, vou desativar a confirmação obrigatória de e-mail (auto-confirm), garantindo que após criar a conta o usuário entre direto e o aceite ocorra automaticamente.

## Fluxo final do convidado

1. Owner/admin clica em **Gerar link de convite** → escolhe papel/expiração/usos → copia URL `https://app.../invite/<token>`.
2. Envia o link manualmente (WhatsApp, e-mail, etc).
3. Convidado abre o link:
   - **Não logado** → vê tela "Convite para {Org}" com **Criar conta** (ou Entrar). Token preservado em `?invite=<token>`.
   - Após cadastro → login automático → redireciona para `/invite/<token>` → **aceite executado automaticamente** → entra direto na org/Dashboard.
   - **Já logado** → mesma rota dispara aceite automático.

## Mudanças

**`src/pages/TeamPage.tsx`**
- Remover `useInviteMember`, estados `email`/`role`, `handleInvite` e o `<Card>` "Adicionar membro".
- Substituir por card "Convidar novo membro" com texto explicativo + botão "Gerar link de convite" (mantém o `InviteLinkDialog` já existente).
- Manter o botão no header opcional (ou remover — fica só dentro do card).

**`src/pages/AcceptInvitePage.tsx`**
- Adicionar `useEffect` que dispara `handleAccept()` automaticamente quando: `info?.valid === true` && `user` está autenticado && `!accepting`. Manter o botão como fallback caso falhe.

**Auto-confirm de e-mail (Lovable Cloud Auth)**
- Habilitar `mailer_autoconfirm = true` para que o usuário recém-cadastrado entre direto sem precisar clicar em link de e-mail. Isso é necessário para que o convite funcione "criar conta → já dentro da org" em um único passo.

## Por que não usar mais o "Adicionar membro" direto

Adicionar alguém pelo e-mail só funciona se ele já tem perfil cadastrado no sistema — o que faz com que o admin precise pedir ao convidado para se registrar antes. O link compartilhável resolve isso: a conta é criada dentro do próprio fluxo de aceite e o vínculo com a organização é garantido pela função `accept_invite` (server-side, com papel pré-definido no token).

## Arquivos

**Modificados**
- `src/pages/TeamPage.tsx` — remove formulário "Adicionar membro", adiciona card "Convidar novo membro".
- `src/pages/AcceptInvitePage.tsx` — auto-aceite quando autenticado.

**Configuração**
- Ativar auto-confirm de e-mail no Lovable Cloud Auth.
