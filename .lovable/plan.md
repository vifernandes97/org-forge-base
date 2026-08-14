# Ajustes no card do funil (Kanban)

## O que muda no card

Ordem final das informações:

```text
Empresa (título)                    [avatar] [ícone WhatsApp]
Nome do contato
Tipo de negócio (campo personalizado)
WhatsApp / telefone do lead
★★★☆☆                                        19h
tags
```

1. Remover a linha duplicada: hoje o card mostra "Empresa" (company_name) e também
   "Razão social" (company), que na prática têm o mesmo conteúdo. A linha de `company`
   sai do card.
2. Título continua sendo a Empresa (com o nome do contato como reserva quando não houver empresa).
3. Abaixo do título, o nome do contato.
4. Abaixo do nome, o valor do campo personalizado "Tipo de negócio" (quando preenchido),
   em estilo discreto.
5. Exibir o telefone/WhatsApp do lead como texto clicável (abre o WhatsApp), mantendo
   também o ícone verde no topo do card.
6. No canto inferior direito, manter apenas o tempo relativo de entrada (ex.: 19h, 15d)
   e remover a data/hora ("13/08, 17:47"). Vale para o estado normal e para o estado de
   SLA excedido; a data completa pode ficar como tooltip.

## Detalhes técnicos

- Arquivo: `src/components/leads/kanban/KanbanCard.tsx`.
- O campo personalizado é resolvido cruzando `lead.custom_field_values` (já carregado em
  `getLeads`) com as definições de `useCustomFields()`, casando por `field_name`/`field_label`
  normalizado para "tipo de negócio" (aceita variações como `tipo_de_negocio`).
  Se a organização não tiver esse campo, a linha simplesmente não aparece.
- Nenhuma mudança de banco de dados ou de regra de negócio.
