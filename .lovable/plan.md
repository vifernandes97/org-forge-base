

# PWA Instalável (Opção 1) — Manifest + Ícones + Meta tags

Adicionar suporte a instalação ("Adicionar à tela inicial") sem service worker e sem `vite-plugin-pwa`. App abre em modo standalone, mas **não tem funcionamento offline** — o que evita os problemas conhecidos de PWA com a preview da Lovable.

## O que será implementado

1. **`public/manifest.webmanifest`** — manifest do app com:
   - `name`: "CRM"
   - `short_name`: "CRM"
   - `description`: "CRM multi-tenant para gestão de leads e vendas"
   - `start_url`: "/"
   - `scope`: "/"
   - `display`: "standalone"
   - `orientation`: "portrait"
   - `background_color`: "#ffffff"
   - `theme_color`: "#3B82F6" (azul do brand já usado no favicon)
   - `icons`: referências aos ícones gerados (192, 512, 512 maskable)

2. **Ícones PWA em `public/`** gerados a partir do mesmo design do `favicon.svg` (retângulo azul `#3B82F6` arredondado com 3 barras brancas):
   - `public/icon-192.png` (192×192)
   - `public/icon-512.png` (512×512)
   - `public/icon-maskable-512.png` (512×512 com safe area para Android)
   - `public/apple-touch-icon.png` (180×180, para iOS)

3. **`index.html`** — adicionar no `<head>`:
   - `<link rel="manifest" href="/manifest.webmanifest" />`
   - `<link rel="apple-touch-icon" href="/apple-touch-icon.png" />`
   - `<meta name="theme-color" content="#3B82F6" />`
   - `<meta name="apple-mobile-web-app-capable" content="yes" />`
   - `<meta name="apple-mobile-web-app-status-bar-style" content="default" />`
   - `<meta name="apple-mobile-web-app-title" content="CRM" />`
   - `<meta name="mobile-web-app-capable" content="yes" />`

## O que NÃO será feito (de propósito)

- **Sem `vite-plugin-pwa`** — não precisa de dependência nova.
- **Sem service worker** — evita problemas de cache na preview da Lovable.
- **Sem funcionamento offline** — requer service worker (Opção 2).
- **Sem prompt de instalação customizado** (`beforeinstallprompt`) — navegador mostra o prompt nativo (ícone na barra do Chrome / "Adicionar à tela inicial" no menu do Safari).

## Arquivos afetados

| Arquivo | Ação |
|---|---|
| `public/manifest.webmanifest` | **Novo** — manifest do app |
| `public/icon-192.png` | **Novo** — ícone 192×192 |
| `public/icon-512.png` | **Novo** — ícone 512×512 |
| `public/icon-maskable-512.png` | **Novo** — ícone maskable 512×512 |
| `public/apple-touch-icon.png` | **Novo** — ícone iOS 180×180 |
| `index.html` | Adicionar `<link rel="manifest">`, apple-touch-icon, theme-color e meta tags mobile |

## Resultado

- No Chrome desktop/Android: ícone de "instalar" aparece na barra; abre em janela própria sem chrome do navegador.
- No Safari iOS: opção "Adicionar à Tela de Início" funciona com ícone correto e abre standalone.
- App identificado pelo SO com nome "CRM", ícone azul e theme color azul na status bar Android.
- Sem regressão na preview da Lovable (nenhum service worker registrado).

## Observação

Para ver a instalação funcionando de verdade, é preciso testar na **URL publicada** (`https://org-forge-base.lovable.app`), não na preview do editor. Navegadores só mostram o prompt de instalação em contextos top-level (não em iframe).

