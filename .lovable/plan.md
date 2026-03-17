

# Atualizar ícones no drawer do lead

## Mudanças em `src/components/leads/LeadDetailSheet.tsx`

1. **Instagram** (`company_instagram`): trocar `Building2` por `Instagram` (lucide-react tem esse ícone)
2. **Tipo de negócio**: não existe um campo com esse nome no drawer atualmente. Os campos visíveis são: Email, Telefone, Empresa, Razão Social, Instagram, Média de festas, Valor, Fonte, Prioridade.

**Pergunta**: qual desses campos corresponde a "Tipo de negócio"? Ou deseja que eu crie um novo campo `tipo_de_negocio` no lead?

### O que será feito com certeza
- Importar `Instagram` de `lucide-react`
- Trocar o ícone do campo `company_instagram` de `Building2` para `Instagram`

### Pendente de confirmação
- Identificar qual campo é "Tipo de negócio" para atualizar seu ícone (ou criar o campo se não existir)

