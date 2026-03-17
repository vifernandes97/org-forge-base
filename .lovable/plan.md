

# Fix: `media_de_festas` não salva via webhook

## Problema
O campo `media_de_festas` é corretamente mapeado do payload (aliases funcionam), mas não é incluído nos objetos de criação e atualização do lead dentro da Edge Function.

## Correções em `supabase/functions/inbound-webhook/index.ts`

### 1. CREATE path (linha ~399)
Adicionar `media_de_festas: mappedData.media_de_festas || null` ao objeto `leadData`.

### 2. UPDATE path (linha 301)
Adicionar `"media_de_festas"` ao array de campos no loop de merge:
```
["name", "email", "phone", "company", "company_name", "company_instagram", "media_de_festas", "notes"]
```

### 3. Re-deploy da Edge Function
Deploy automático após edição.

