

# Permitir Light Mode na Sidebar

## Problema
A sidebar usa variáveis CSS escuras mesmo no tema claro (`:root` define `--sidebar-background: 222 47% 11%` — quase preto). Isso faz o app parecer sempre escuro.

## Solução
Atualizar as variáveis da sidebar no `:root` (light mode) em `src/index.css` para usar cores claras, mantendo as variáveis escuras apenas no `.dark`.

### Arquivo alterado
| Arquivo | Mudança |
|---------|---------|
| `src/index.css` | Atualizar variáveis `--sidebar-*` no `:root` para tons claros |

### Valores propostos para `:root` (light mode)
```css
--sidebar-background: 0 0% 98%;        /* quase branco */
--sidebar-foreground: 222 47% 11%;      /* texto escuro */
--sidebar-primary: 217 91% 60%;         /* azul (mantém) */
--sidebar-primary-foreground: 0 0% 100%;
--sidebar-accent: 210 40% 96%;          /* cinza claro */
--sidebar-accent-foreground: 222 47% 11%;
--sidebar-border: 214 32% 91%;          /* borda clara */
--sidebar-ring: 217 91% 60%;
```

Mudança apenas nas variáveis CSS — nenhum componente precisa ser alterado.

