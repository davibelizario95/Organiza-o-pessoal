# Organização Pessoal

Sistema pessoal de organização — Devocional, Casa, Saúde, Estudo, Trabalho e
Financeiro em um só lugar, com agenda integrada e board Kanban para o
Trabalho. É um app web (PWA) instalável no celular, sem login tradicional.

Feito em **JavaScript puro (ES modules), sem framework nem bundler** — abre
direto num servidor estático. Isso foi uma escolha forçada pelo ambiente onde
foi gerado (sem Node/npm disponível), mas tem a vantagem de ser leve e fácil
de hospedar em qualquer lugar.

## Como rodar localmente

Qualquer servidor de arquivos estáticos serve. Exemplos:

```bash
cd "Downloads/Claude"
python3 -m http.server 8080
```

Depois abra `http://localhost:8080`. **Não abra `index.html` direto com
`file://`** — módulos ES e o Service Worker exigem `http://`.

## Publicar de verdade (para instalar no celular)

Suba a pasta inteira para qualquer hospedagem estática com HTTPS:
[Netlify](https://app.netlify.com/drop) (arraste a pasta e pronto), [Vercel](https://vercel.com),
GitHub Pages, Firebase Hosting, Cloudflare Pages, etc. Não precisa de build —
é só copiar os arquivos.

## Como funciona sem login

Na primeira vez, você escolhe (ou cria) um perfil numa lista. Cada perfil tem
um **PIN de 4 dígitos** e um **link único**. Depois de confirmar uma vez num
aparelho, ele fica "confiado" e não pede PIN de novo. Para usar o mesmo
perfil no celular, copie o link único (em **Ajustes → PIN/link**) e abra lá —
ou digite o PIN manualmente.

Isso por si só **não sincroniza dados entre aparelhos** — cada navegador
guarda os dados localmente (`localStorage`) até você configurar o Firebase
(próxima seção). Sem Firebase, o app funciona 100% offline e local.

## Ativar sincronização entre computador e celular (Firebase)

1. Acesse [console.firebase.google.com](https://console.firebase.google.com) e crie um projeto (gratuito).
2. No projeto, clique em **Adicionar app → Web** (ícone `</>`), dê um nome e crie o app.
3. Copie o objeto de configuração mostrado (`{ apiKey: ..., authDomain: ..., ... }`).
4. No menu lateral do Firebase, ative:
   - **Firestore Database** → Criar banco de dados → modo produção (qualquer região).
   - **Authentication → Sign-in method** → ative **Anônimo**.
     (O app usa login anônimo automático e invisível — sem tela, sem senha —
     só para que as regras do Firestore possam exigir usuário autenticado.)
5. Em **Firestore → Regras**, use algo como:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```
6. No app, vá em **Ajustes → Sincronização entre aparelhos**, cole o objeto de
   configuração (JSON) e salve. O app recarrega e passa a sincronizar.
7. Repita o passo 6 (colar a mesma config) em cada aparelho que for usar.

Sem isso, tudo bem — o app continua funcionando localmente em cada aparelho.

## Ativar integração com Google Agenda

1. Acesse [console.cloud.google.com](https://console.cloud.google.com), crie um projeto.
2. **APIs e serviços → Biblioteca** → ative a **Google Calendar API**.
3. **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**.
   - Tipo de aplicativo: **Aplicativo da Web**.
   - Em "Origens JavaScript autorizadas", adicione a URL onde o app está hospedado
     (ex: `https://seusite.netlify.app`, e também `http://localhost:8080` se for testar local).
4. Copie o **Client ID** gerado.
5. No app, vá em **Ajustes → Google Agenda**, cole o Client ID e salve.
6. Clique em **Conectar Google Agenda** e aceite o consentimento do Google.
7. Na tela **Agenda**, use **Sincronizar com Google Agenda** sempre que quiser
   enviar/trazer eventos (a sincronização é sob demanda, não automática em segundo plano).

## Instalar como app (PWA)

No celular, abra o site no navegador e:
- **Android/Chrome**: menu (⋮) → "Adicionar à tela inicial".
- **iPhone/Safari**: botão de compartilhar → "Adicionar à Tela de Início".

## Estrutura do projeto

```
index.html            shell da aplicação (SPA)
css/styles.css         design system completo (claro/escuro, responsivo)
manifest.webmanifest    metadados do PWA
sw.js                   service worker (cache offline do app shell)
js/
  app.js                bootstrap, roteador de topo, montagem do shell
  router.js              roteador via hash (#/dashboard, #/trabalho, ...)
  state.js                estado global reativo + seleção/troca de perfil
  store.js                camada de dados (Firestore OU localStorage)
  firebase.js              carregamento sob demanda do SDK Firebase (CDN)
  googleCalendar.js         integração OAuth + Calendar API
  config.js                 leitura/gravação da config (Firebase/Google) salva em Ajustes
  frentes.js                 definição das 6 frentes, contextos e colunas do board
  idb.js                     IndexedDB para os áudios das notas de voz
  icons.js                   ícones SVG inline
  components/                peças reutilizáveis: nav, modal, toast, card,
                              cronômetro, captura rápida, gravador de voz, templates
  views/                      uma tela por rota: dashboard, frente genérica,
                              trabalho (Kanban), agenda, ajustes, revisão semanal
scripts/
  gen_icons.py               gera os ícones PNG do PWA (sem dependências)
  serve.py                   servidor estático simples para desenvolvimento
```

## Limitações conhecidas

- **Notas de voz** ficam salvas só no aparelho onde foram gravadas
  (IndexedDB) — não sincronizam entre computador e celular. Dá pra evoluir
  isso depois usando o Firebase Storage.
- **Transcrição automática de voz** não foi incluída nesta versão (por
  decisão ao planejar o projeto) — o áudio é gravado e anexado ao card
  normalmente, pronto para plugar um serviço de transcrição (ex: Whisper) no
  futuro.
- A sincronização com o Google Agenda é **manual** (botão "Sincronizar"), não
  em tempo real — evita a complexidade de um servidor de backend só para isso.
- O PIN de perfil é uma identificação leve, não uma segurança forte — qualquer
  pessoa com o link único ou o PIN entra no perfil.
