# SDD — Frontend de gestão geoespacial (Protected Areas SC)

Complementa `docs/PRD.md`, que define duas fases de entrega: **Fase 1** (demonstração de amanhã,
visualmente completa, `UC-CW01` real, resto mock/desabilitado) e **Fase 2** (produto completo,
autenticação real na API). Este documento marca claramente o que cada decisão técnica vale para
cada fase — nada aqui é reescrito na Fase 2, só *ligado* ao que hoje é mock.

## 1. Visão geral de arquitetura

```text
                         rede docker "pipeline" (external, já existe)
                     ┌───────────────────────────────────────────────────┐
 navegador  ── HTTP ──▶  protected-areas-sc-frontend (novo)               │
 (usuário)             │  nginx:alpine                                    │
                        │   - serve o build estático do React             │
                        │   - proxy_pass /api/*  ──▶  protected-areas-sc-api:8000
                        └───────────────────────────────────────────────────┘
                                          │
                                          ▼
                               protected-areas-sc-api (existe, sem mudança na Fase 1)
                               FastAPI: /api/v1/imports, /api/v1/ucs (Fase 1 e 2)
                                        /api/v1/auth (Fase 2, seção 2)
                                          │
                                          ▼
                               protected-areas-sc-db-main (existe)
                               PostGIS: domínio geoespacial + tabelas novas da Fase 2
```

Decisão central, válida desde a Fase 1: o navegador **só fala com a origem do frontend**. Em
produção/demo, o Nginx do container faz reverse proxy de `/api/*` para
`protected-areas-sc-api:8000` na mesma rede `pipeline` externa; em desenvolvimento local, o
próprio Vite faz o mesmo papel (seção 3.7). Em nenhum dos dois casos o navegador aponta direto
para `localhost:8000` — por isso a API **nunca precisa habilitar CORS** para nenhuma origem, em
nenhuma das duas fases.

Na Fase 1, login/sessão não passam pelo Nginx nem pela API: são estado local do navegador (seção
3.3). O único tráfego real para a API nesta fase é o fluxo de `UC-CW01`
(`/api/v1/imports/*`, `/api/v1/ucs/*`, já existentes, sem alteração).

**Consequência de implementação na API (só entra na Fase 2):** o cookie de sessão emitido pelo
backend não deve declarar `Domain=` explícito, para funcionar corretamente atrás do proxy em
qualquer host.

## 2. Novo backend: autenticação e contas (Fase 2, na própria FastAPI)

Nada nesta seção existe na Fase 1. É o contrato a implementar quando a Fase 2 começar — a UI da
Fase 1 já é desenhada para trocar o driver mock por este contrato sem reescrever componentes
(seção 3.3).

Decisão já tomada: não cria serviço novo. Adiciona um módulo `app/api/v1/auth_routes.py` +
`app/application/auth.py` seguindo a mesma separação de camadas (`api` → `application` →
`domain`/`infrastructure`) já usada em `ucs_routes.py`/`UCService`.

### 2.1 Modelo de sessão

Sessão opaca em tabela, não JWT: token aleatório (32 bytes, `secrets.token_hex`), guardado no
navegador como cookie `httpOnly`, `Secure`, `SameSite=Lax`; no banco, guarda-se apenas o hash
SHA-256 do token (nunca o token em claro), com expiração e possibilidade de revogação imediata.
Motivo da escolha em vez de JWT: com poucos usuários (um admin, alguns operadores), a simplicidade
de "desativei o usuário → próxima requisição falha" sem lidar com revogação de JWT stateless pesa
mais do que o ganho de estatelessness. Se o projeto crescer, dá para migrar para JWT depois sem
mudar o contrato de fora (login/me continuam iguais).

### 2.2 Migração `006_auth_users.sql`

Segue a numeração das migrações existentes (`001` a `005` em `X:\fast-api-protected-areas-sc\migrations`)
— confirmar no início da Fase 2 que `006` ainda está livre.

```sql
CREATE TABLE app_user (
    id              BIGSERIAL PRIMARY KEY,
    username        VARCHAR(120) NOT NULL UNIQUE,
    nome            VARCHAR(255) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(20)  NOT NULL CHECK (role IN ('admin', 'operador')),
    ativo           BOOLEAN      NOT NULL DEFAULT TRUE,
    criado_por      BIGINT       REFERENCES app_user(id),
    criado_em       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE app_session (
    token_hash      CHAR(64) PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES app_user(id),
    criado_em       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expira_em       TIMESTAMP NOT NULL,
    revogado_em     TIMESTAMP
);
CREATE INDEX idx_app_session_user ON app_session(user_id);
```

`password_hash` usa `argon2` (`argon2-cffi`, já recomendado sobre `bcrypt` puro por não ter
limite de 72 bytes e ser o padrão atual da OWASP). Adicionar `argon2-cffi` às dependências da API.

### 2.3 Bootstrap do primeiro administrador

Não existe tela de "primeiro cadastro". No startup da API, se `app_user` estiver vazia, criar um
admin a partir de variáveis de ambiente (mesmo padrão já usado para segredos no projeto, como
`FIRMS_MAP_KEY`): `PA_SC_ADMIN_BOOTSTRAP_USERNAME` e `PA_SC_ADMIN_BOOTSTRAP_PASSWORD`. Se essas
variáveis não estiverem definidas e a tabela estiver vazia, a API sobe normalmente mas loga um
aviso claro — ninguém consegue logar até alguém definir essas variáveis e reiniciar. Essas
variáveis não devem ser versionadas (mesma regra já aplicada a `FIRMS_MAP_KEY` no `.env.example`).

### 2.4 Contrato de endpoints novo

| Método/rota | Quem pode | Corpo/resposta |
|---|---|---|
| `POST /api/v1/auth/login` | Público | `{username, password}` → `Set-Cookie` de sessão + `200 {id, nome, role}`; `401` se credenciais inválidas ou conta inativa |
| `POST /api/v1/auth/logout` | Autenticado | Revoga a sessão atual (marca `revogado_em`), limpa o cookie |
| `GET /api/v1/auth/me` | Autenticado | `{id, nome, role}`; `401` se sessão ausente/expirada/revogada |
| `POST /api/v1/auth/users` | Somente `admin` | `{username, nome, password, role}` → `201` com o usuário criado (sem hash na resposta); `409` se `username` já existe |
| `GET /api/v1/auth/users` | Somente `admin` | Lista `{id, username, nome, role, ativo, criado_em}` |
| `PATCH /api/v1/auth/users/{id}` | Somente `admin` | `{ativo: bool}` — ativa/desativa; desativar revoga todas as sessões daquele usuário na mesma transação |

Erros seguem o mesmo padrão `application/problem+json` já usado no resto da API
(`app/domain/models.py::ProblemDetail`), para o frontend reaproveitar o mesmo tratamento de erro
dos cenários geoespaciais.

Uma dependency FastAPI `require_role("admin")` (análoga a `get_uc_service` em
`app/api/dependencies.py`) protege as três rotas de `/auth/users`.

### 2.5 Proteger `/imports` e `/ucs` existentes — trabalho real, não um adendo

Quando a Fase 2 começa, `/api/v1/imports/*` e `/api/v1/ucs/*` passam a exigir
`get_current_user` (qualquer papel autenticado, sem diferenciar admin/operador). Isso **quebra a
suíte de testes atual da API** (hoje chamam esses endpoints sem sessão) e o roteiro do
`docs/GUIA_TESTES_POSTMAN.md`. Planejar como parte do mesmo incremento: atualizar fixtures de
teste para autenticar antes de cada chamada, e revisar o guia do Postman para incluir o passo de
login.

### 2.6 Endpoint de busca de UC por identificador (Fase 2, novo)

`UC-CW04` (atualizar) precisa que o operador ache a UC certa antes de agir —
`GET /api/v1/ucs/{uc_id}` aceita o `id_uc` interno numérico do PostGIS, que ninguém de fora
conhece. Foi adicionado:

```text
GET /api/v1/ucs?cd_cnuc=...
GET /api/v1/ucs?wdpa_pid=...
```

Somente leitura, um filtro por vez, devolve uma lista de zero ou um item com `id`, `name`,
identificadores e `geometry_version`. Não toca no caminho de escrita
(`Bronze → Airflow → PostGIS`), só estende a leitura que `UCService`/`ucs_routes.py` já expõe.
O formulário de `UC-CW04` usa a versão retornada como `expected_version`. `UC-CW07` não depende
dessa busca: seu contrato aceita `uc_identifier` diretamente e o pipeline resolve o vínculo.

## 3. Frontend

### 3.1 Design system e linguagem visual

A Fase 1 é, antes de tudo, uma demonstração visual — a maior parte do que aparece amanhã na tela
são os 6 cenários **desabilitados**, então a linguagem visual deles importa tanto quanto a do
único cenário que funciona. Não nasce como protótipo cinza "para arrumar depois".

**Decisão: shadcn/ui sobre Tailwind CSS + Radix UI**, não uma lib de componentes fechada
(Ant Design, MUI, Chakra). Motivo: shadcn não é dependência de runtime — os componentes são
copiados para dentro do projeto (o time é dono do código e do tema, sem ficar preso a versão ou
convenção visual de terceiro), já nascem acessíveis (Radix resolve foco, navegação por teclado e
ARIA) e os primitivos de formulário do próprio shadcn (`Field`/`FieldGroup`/`FieldError`, ver a
correção na seção 3.2) já são pensados para react-hook-form + zod por baixo — a mesma dupla já
escolhida para os formulários de cenário (3.5).

Peças do design system:

- **Base:** Tailwind CSS v4 (utilitários, sem CSS-in-JS), com os tokens de tema (cor, espaçamento,
  raio, sombra) definidos em CSS puro (`@theme inline` em `src/index.css`), não em
  `tailwind.config.ts` — **correção em relação ao parágrafo original desta seção**: a v4 do
  Tailwind não usa mais arquivo de configuração JS/TS para tema; um único lugar para mudar a cara
  do produto inteiro continua existindo, só que é `src/index.css`.
- **Componentes:** shadcn/ui — `Button`, `Input`, `Select`, `Textarea`, `Field`/`FieldGroup`/
  `FieldError` (não `Form`, ver a correção na seção 3.2), `Card`, `Table`, `Badge`, `Tabs`,
  `Dialog`, `Tooltip`, `Skeleton`.
- **Notificação:** `sonner` (toast), integração oficial do ecossistema shadcn.
- **Ícones:** `lucide-react` — mesma família visual do shadcn por padrão.
- **Tipografia:** Inter, **self-hosted** dentro do bundle (arquivo de fonte local, não Google
  Fonts via CDN) — mantém o CSP `style-src`/sem fonte externa (seção 5.3) sem precisar abrir uma
  exceção de domínio.
- **Paleta:** identidade institucional Univali — predominantemente branca, contrastando com o azul
  do logo oficial (`--primary`, extraído do próprio logo), com variações claras de gradiente
  usadas com moderação (faixa fina no topo do cabeçalho, rodapé); três cores semânticas fixas —
  sucesso, atenção, erro — usadas **só** para estado (badge de `SUCCEEDED`/`PROCESSING`/`FAILED`,
  validação de campo), nunca como decoração. Um conjunto separado de tokens de marca
  (`--brand`/`--brand-light`/`--brand-dark`/`--brand-foreground`) fica deliberadamente fixo — não
  reage à troca de tema — porque o cabeçalho/rodapé precisam sempre bater com a cor real do logo,
  claro ou escuro.
- **Dois modos, escuro por padrão.** A interface implementa um alternador de tema (escuro/
  claro). Uma preferência explícita por claro continua válida nas próximas visitas;
  sem preferência salva, a interface inicia em escuro, inclusive antes da hidratação React.
  Implementação própria em
  `components/theme/ThemeProvider.tsx` (não `next-themes`, ver 3.2), preferência guardada em
  `localStorage` (escolha de tema não é dado de sessão).

Padrões de tela, válidos desde a Fase 1:

- **App shell fixo:** barra lateral esquerda com navegação (Cenários, Histórico, Admin — este
  último só visível para o papel `admin`) e topo com nome do usuário logado + sair; conteúdo em
  `Card` centralizado, espaçamento generoso na grade 4/8px do Tailwind.
- **Formulário de cenário:** um `Card` por cenário ativo, label acima do campo (nunca
  placeholder-como-label), erro de validação inline abaixo do campo, um único botão primário de
  envio por tela.
- **Acompanhamento de importação:** indicador de etapas — `Enviado → Validado → Publicado →
  Processando → Concluído` — em vez de só um spinner; o usuário vê em que fase do pipeline está.
  Estado terminal usa a cor semântica correspondente (verde/vermelho).
- **Cenários desabilitados** (`CW02`/`03`/`04`/`05`/`06`/`07` na Fase 1): mesmo `Card`, em tom
  esmaecido, com `Badge` — "Disponível na próxima etapa" para `CW02`/`04`/`07`, "Ainda não
  implementado na API" para `CW03`/`05`/`06` (PRD, seção 4) — e `Tooltip` explicando o motivo ao
  passar o mouse. Nunca escondido, nunca um card quebrado ou sem estilo.
- **Estados vazios e de carregamento:** toda lista (histórico, contas do painel) tem um estado
  vazio desenhado, não uma tabela em branco, e um estado de carregamento com `Skeleton`, não um
  spinner genérico central.
- **Feedback de ação:** toda mutação, mesmo mock (Fase 1), dispara um `toast` de confirmação ou
  erro — nunca uma mudança de estado silenciosa.

Isso vale desde a Fase 1: a demonstração de amanhã já nasce com essa linguagem visual, não como
protótipo cinza pra "arrumar depois" — inclusive porque os 6 cenários desabilitados são a maior
parte do que vai aparecer na tela amanhã, então o tratamento visual deles importa tanto quanto o
de `UC-CW01`.

### 3.1.1 Fluxo de trabalho de design com Claude Code

As ferramentas abaixo estão disponíveis no ambiente de desenvolvimento atual e devem ser
utilizadas como apoio durante a implementação do frontend.

#### Direção visual

Utilizar:

- `frontend-design:frontend-design`
- `ui-ux-pro-max:design`
- `ui-ux-pro-max:design-system`

Essas skills devem ser usadas antes da implementação visual relevante para definir: linguagem
visual, tipografia, paleta, hierarquia, espaçamentos, design tokens e padrões de componentes.
Evitar decidir esses elementos de forma improvisada durante a codificação.

#### Componentes

Para componentes React/Tailwind, utilizar `ui-ux-pro-max:ui-styling` — como **orientação** de
como montar e estilizar, não como substituto da biblioteca em si:

```text
ui-styling            →  orienta como montar/estilizar
shadcn/ui + Radix     →  biblioteca/componentes reais (instalados via CLI, npx shadcn add ...)
```

Priorizar componentes existentes do shadcn/ui e Radix quando aplicáveis, evitando recriar
componentes básicos sem necessidade.

#### Referências visuais

Não há atualmente uma skill dedicada chamada `extract-design-system`.

Quando houver um site, screenshot ou interface de referência, analisar manualmente: cores,
tipografia, grid, spacing, border radius, sombras, componentes e comportamento responsivo. Essas
informações devem ser traduzidas para o design system do projeto, sem copiar código proprietário.

#### QA visual

Playwright MCP verificado nesta sessão (14/09/2026): navegação real para `https://example.com`
via `mcp__playwright__browser_navigate` (sem WebFetch/curl), título de página lido corretamente
("Example Domain") e screenshot capturado com `mcp__playwright__browser_take_screenshot` sem
erro. As ferramentas `mcp__playwright__browser_*` estão de fato utilizáveis, não só listadas.

Após alterações visuais relevantes, utilizar o MCP do Playwright para:

1. abrir a aplicação no navegador;
2. validar diferentes larguras de viewport;
3. capturar screenshots;
4. verificar overflow e desalinhamentos;
5. verificar erros de console;
6. revisar responsividade;
7. corrigir os problemas encontrados;
8. executar nova validação.

Validar, quando aplicável: 375 px, 768 px, 1440 px.

`claude-in-chrome` é a alternativa quando o MCP do Playwright não estiver disponível numa sessão
futura — mesma finalidade (abrir página real, screenshot, console), mecanismo diferente.

O frontend não deve ser considerado concluído apenas porque compilou ou porque os testes
automatizados passaram.

#### Disponibilidade das ferramentas

Plugins e MCPs pertencem ao ambiente de desenvolvimento e não ao código-fonte do projeto. Cada
nova sessão do Claude Code deve confirmar a disponibilidade das ferramentas (`/skills`, `/mcp`)
antes de depender delas, porque o trabalho pode trocar de computador.

Na ausência dessas ferramentas, as especificações de design definidas neste SDD continuam sendo a
fonte de verdade e não devem bloquear a implementação.

**Achado real (14/09):** a instalação de `frontend-design`/`ui-ux-pro-max` e o `claude mcp add
playwright` da sessão anterior foram registrados sob o projeto **`pipeline-protected-areas-sc`**
(escopo de projeto/local), não sob este repositório — provavelmente porque o diretório de trabalho
efetivo daquela sessão, no momento exato desses comandos, resolvia para lá. Resultado prático:
`/skills` e `mcp__playwright__*` apareciam "disponíveis" na conversa anterior, mas nenhuma sessão
aberta neste repositório os enxergava. Corrigido nesta sessão criando, neste repositório:
`.claude/settings.json` (`enabledPlugins`, reaproveitando o cache já baixado, sem novo download) e
`.mcp.json` de escopo `project` para o Playwright (`claude mcp add -s project playwright -- npx -y
@playwright/mcp@latest`). Lição para as próximas vezes: ferramenta "instalada" numa sessão não é a
mesma coisa que "disponível neste repositório" — confirmar sempre com o diretório de trabalho
correto antes de instalar, e checar `.claude/settings.json`/`.mcp.json` do próprio repositório (não
só `/skills`/`/mcp` numa sessão que pode já estar no diretório certo por acidente).

### 3.2 Stack

- **React 19 + TypeScript + Vite** (build rápido, sem servidor Node em produção — o runtime final
  é só Nginx servindo arquivos estáticos). **Correção em relação ao parágrafo original desta
  seção**: o scaffold inicial (14/09) usou React 18, mas os componentes do registry `radix-nova`
  do shadcn não usam `forwardRef` — passam `ref` como prop comum, suporte que só existe a partir do
  React 19. Em React 18 isso produzia um erro real de console ("Function components cannot be
  given refs") em qualquer campo composto com react-hook-form. Resolvido subindo para React 19 em
  vez de trocar de registry ou de biblioteca de formulário.
- **Tailwind CSS + shadcn/ui + Radix + lucide-react + sonner** (3.1).
- **react-router-dom** para rotas e guarda de rota por papel.
- **TanStack Query** para chamadas à API (cache, retry, polling do estado da importação).
- **react-hook-form + zod** para os formulários de cenário e de criação de conta, compostos com
  `Field`/`FieldGroup`/`FieldError` do shadcn (3.1) — **correção em relação ao parágrafo original
  desta seção**: o registry atual do shadcn (`style: radix-nova`, escaffoldado em 14/09) não tem
  mais o componente `Form` (o wrapper clássico que embutia `Controller`/`FormProvider` do RHF —
  `npx shadcn add form` não cria arquivo nenhum, silenciosamente). No lugar, o registry oferece
  `Field`/`FieldSet`/`FieldGroup`/`FieldLabel`/`FieldDescription`/`FieldError`, que são primitivos
  de layout/acessibilidade agnósticos de biblioteca de formulário — funcionam com react-hook-form,
  mas exigem `register()`/`formState.errors` amarrados manualmente em vez de "zero adaptação".
  Continua sendo react-hook-form + zod por baixo, só a cola é um pouco mais explícita.
- Sem Redux/estado global pesado: sessão do usuário fica em um `AuthContext` (3.3), atrás de uma
  interface (`AuthDriver`) que troca de implementação entre Fase 1 (mock local) e Fase 2 (API
  real) sem mudar quem consome o contexto.
- **Tema claro/escuro com implementação própria** (`components/theme/ThemeProvider.tsx`), não
  `next-themes`: a biblioteca disparava um erro real de console ("Encountered a script tag while
  rendering React component") por assumir um framework com SSR (ela injeta um `<script>` inline
  para aplicar o tema antes da hidratação, um passo que não existe numa SPA puramente client-side
  como esta). A implementação própria troca a classe no `documentElement` e guarda a escolha em
  `localStorage` (3.1).

**Nota de implementação (14/09, passo 1 da seção 8):** o ambiente de desenvolvimento tem Node
v22.4.0, abaixo do mínimo hoje exigido por `vite@8` (rolldown como bundler padrão — quebra com
"Cannot find native binding" nesta combinação de Node/Windows) e por `typescript@7`
(reescrita nativa, remove `baseUrl` do `tsconfig.json` sem compatibilidade). O scaffold fixa
`vite@^6.4.3` (esbuild/rollup, sem binário nativo) e `typescript@~5.8.3` deliberadamente — não
atualizar para a versão mais nova "por padrão" sem antes checar se o Node instalado a suporta
(`node -v` contra o `engines` do pacote).

### 3.3 Autenticação — Fase 1 (mock local) e Fase 2 (real)

Um único contrato TypeScript, duas implementações:

```ts
interface AuthDriver {
  login(username: string, password: string): Promise<{ id: string; nome: string; role: "admin" | "operador" }>;
  logout(): Promise<void>;
  me(): Promise<{ id: string; nome: string; role: "admin" | "operador" } | null>;
}
```

- **`LocalMockAuthDriver`** (Fase 1): não chama a API. `login` aceita qualquer usuário/senha (ou
  um par fixo combinado só entre você e o orientador) e guarda `{ id, nome, role }` em
  `sessionStorage` — sobrevive a uma atualização de página (F5 não derruba a sessão durante uma
  demonstração), mas nunca a mais que isso: fechar a aba encerra a sessão, e não é
  `localStorage`, que persistiria entre aberturas do navegador. Não há nada sensível nesse dado
  (só o nome e o papel escolhidos no login, nunca uma senha ou token), então guardá-lo em
  `sessionStorage` não reabre o risco que `FE-SEC-01`/`FE-RNF-03` endereçam para a Fase 2 (onde o
  que trafega é uma sessão de verdade, não uma escolha local). Fica isolado em um único arquivo,
  claramente nomeado, sem nenhum caminho de código que o apresente como controle de acesso real
  (PRD, `FE-SEC-08`).
- **`ApiAuthDriver`** (Fase 2): chama `POST /api/v1/auth/login`, `GET /api/v1/auth/me`,
  `POST /api/v1/auth/logout` (seção 2.4), sessão em cookie `httpOnly`.

`AuthContext`, `RequireAuth`, `RequireAdmin` e toda a navegação (3.4) consomem só a interface
`AuthDriver` — trocar o mock pelo real na Fase 2 é trocar uma linha de injeção de dependência, não
reescrever componente nenhum.

O painel de administração (`AdminDashboardPage`) segue o mesmo padrão: na Fase 1, lista/cria
conta contra um array em memória (`LocalMockUserRepository`); na Fase 2, contra
`GET`/`POST`/`PATCH /api/v1/auth/users`.

### 3.4 Estrutura de páginas/rotas

```text
/login                          LoginPage (pública)
/                                redireciona: admin → /admin, operador → /cenarios
/admin                           AdminDashboardPage   (guarda: role === 'admin')
  ├─ lista de contas             Fase 1: mock em memória · Fase 2: GET /auth/users
  └─ formulário "criar conta"    Fase 1: mock em memória · Fase 2: POST /auth/users
/cenarios                        ScenarioFormPage      (guarda: autenticado)
  └─ 7 cartões de cenário: UC-CW01 (ativo) | UC-CW02/04/07 (desabilitado, Fase 1) | UC-CW03/05/06 (desabilitado, API)
/cenarios/:scenarioSlug          ScenarioDetailPage    (guarda: autenticado; slugs descritivos)
  ├─ cenário ativo: formulário de envio, ImportStatusPanel e o resumo de validação do arquivo
  └─ cenário desabilitado: o mesmo motivo do cartão, numa tela própria (não só um tooltip)
/historico                       HistoricoPage         (Fase 1: local · Fase 2: persistido)
  └─ lista de importações desta navegação, com o status mais recente já confirmado contra a API
     (não só o que a tela de origem tinha guardado por último)
/historico/:importId            ImportDetailPage      (guarda: autenticado)
  └─ acompanhamento de uma importação específica (ImportStatusPanel e o resumo de validação),
     acessível tanto pela lista de histórico quanto por link direto
```

Cada cartão de cenário é clicável (não só o ativo) e leva para a própria rota — inclusive um
desabilitado, cujo motivo fica mais visível numa tela do que preso a um tooltip que não existe em
toque. Um cartão nunca expande formulário embutido na grade: a navegação para uma rota própria
evita a tela crescer mais do que a altura visível sem indicar isso a quem acabou de clicar. A mesma
regra vale para uma linha da tabela de histórico: leva para `/historico/:importId`, uma tela
própria de acompanhamento, em vez de expandir os detalhes dentro da própria linha.

Um `import_id` que não existe mais (URL digitada errada, ou de uma sessão diferente) precisa de uma
resposta definitiva e visível — "essa importação não existe" — em vez de ficar tentando de novo
indefinidamente: a página distingue um 404 (para de repetir a consulta e mostra a mensagem) de uma
falha passageira de rede (tenta mais algumas vezes antes de desistir).

`localImportHistory` (Fase 1) segue o mesmo padrão de armazenamento do `LocalMockAuthDriver`: grava
em `sessionStorage`, não em memória e não em `localStorage`, pelo mesmo motivo (sobreviver a uma
atualização de página sem virar um armazenamento persistente entre aberturas do navegador). Como o
que fica salvo é só o retorno já público da própria API (identificador, nome de arquivo, status),
essa escolha não carrega o mesmo cuidado de dado sensível do driver de autenticação. A lista em
`HistoricoPage` nunca confia cegamente nesse retrato salvo: toda importação ainda não terminal é
reconsultada diretamente na API (`useQueries`, um `GET /imports/{id}` por item pendente) para que o
status mostrado nunca fique mais desatualizado do que o da própria API.

`RequireAuth` e `RequireAdmin` checam `AuthContext`; sem sessão (mock ou real), redireciona para
`/login`. Não há "modo convidado": tudo além de `/login` exige sessão (PRD, `FE-RF-01`).

### 3.5 Formulário de cenário — desenho único parametrizado

```ts
type ScenarioConfig = {
  id: "UC-CW01" | "UC-CW02" | "UC-CW03" | "UC-CW04" | "UC-CW05" | "UC-CW06" | "UC-CW07";
  domain: "uc" | "za_oficial";
  operation: "create" | "update" | "replace_buffer_abrangencia" | "create_batch" | "extinguish" | "replace_point";
  label: string;
  status: "active" | "coming_soon" | "not_in_api";   // controla o Badge/Tooltip (3.1)
  fields: FieldSchema[];
};
```

Na Fase 1, só `UC-CW01` tem `status: "active"`; `CW02`/`04`/`07` têm `"coming_soon"`;
`CW03`/`05`/`06` têm `"not_in_api"`. Na Fase 2, `CW02`/`04`/`07` viram `"active"`.

**Campos de `UC-CW01`, mapeamento exato para o multipart real** (o único que roda de verdade
amanhã — resolvido agora para não haver ambiguidade no dia da implementação):

| Campo do form | Campo no `POST /api/v1/imports` |
|---|---|
| Arquivo (ZIP/GeoJSON/KML) | `file` |
| — (fixo) | `domain=uc` |
| — (fixo) | `operation=create` |
| Fonte (texto) | dentro de `metadata` → `{"source": "<texto>"}` |
| Nome (só aparece se a validação devolver `MISSING_UC_NAME`) | dentro de `metadata` → adiciona `"name"` |
| Política de duplicidade (`reject_batch`/`skip_duplicates`) | `duplicate_policy` |
| — (fixo, sem toggle avançado nesta fase) | `repair_geometry=false` |

Igual ao exemplo `curl` já documentado no `README.md` da API. Os campos de `CW02`/`04`/`07`
seguem a mesma lógica (README, tabela "Formatos e metadados") quando entrarem na Fase 2.

**`Idempotency-Key` — regra de ciclo de vida, resolvida:** gerada uma vez quando o usuário começa
a preencher uma tentativa de envio (guardada no estado do formulário, não em cada clique).
"Tentar de novo" depois de uma falha de rede reenvia a **mesma** chave e o **mesmo** arquivo — a
API já trata isso corretamente por idempotência de chave + checksum. Só escolher um arquivo novo
ou reiniciar o formulário gera uma chave nova. Nunca gerar chave nova a cada clique de "enviar":
isso mascararia um retry como uma submissão nova e faria o usuário achar que criou algo, ou
esconderia um `DUPLICATE` que deveria aparecer.

**Polling — política concreta, resolvida:** intervalo inicial de 1,5s, backoff até um teto de
10s, teto total de 5 minutos. Ao atingir o teto sem estado terminal, para de atualizar sozinho,
mostra "ainda processando — confira no histórico" com um botão manual de "atualizar agora", e a
importação continua visível no histórico (3.4) para conferência posterior — nunca trava a tela
esperando para sempre.

**Correção da regra de `Idempotency-Key` para o caso `MISSING_UC_NAME`:** o parágrafo acima só
cobre o retry de uma falha de rede (mesmo arquivo, mesmo payload). Corrigir o nome e reenviar é um
payload *diferente* — reaproveitar a mesma chave nesse caso produziria `409 Conflict`, porque o
contrato da API trata chave repetida com corpo diferente como uma reutilização inválida, não como
uma atualização da tentativa anterior. Uma chave nova é gerada nesse ponto especificamente,
mesmo sem o usuário escolher um arquivo novo nem reiniciar o formulário.

**Fluxo em três etapas visíveis (selecionar → validar → iniciar processamento), com
pré-visualização entre a segunda e a terceira:** o botão que cria a importação chama-se "Validar
arquivo", não "Enviar" — reforça que essa etapa só confirma se o arquivo está correto, ainda não
inicia nada no Airflow. Ao aceitar, a tela mostra um resumo (formato detectado, quantidade de
unidades no arquivo, tipo de geometria, CRS de origem e de destino, e os avisos não bloqueantes,
se houver) antes de expor o botão separado "Iniciar processamento", que é quem de fato publica e
dispara o pipeline. Esse resumo já existia por completo no relatório de
`GET /imports/{id}/validation` (seção 2 do contrato da API) mesmo num arquivo aceito, só não
estava sendo mostrado nessa etapa — não foi necessária nenhuma mudança na API para viabilizar a
pré-visualização.

### 3.6 Tratamento e tradução de erro

Mapa fixo traduzindo os códigos de erro já documentados no projeto para pt-BR; código não mapeado
cai num texto genérico, mas `detail`/`type` originais do `problem+json` ficam disponíveis num "ver
detalhes técnicos" — nunca escondidos, só não são a mensagem principal.

```ts
const ERROR_MESSAGES: Record<string, string> = {
  UC_ALREADY_EXISTS: "Essa UC já está cadastrada.",
  UC_VERSION_CONFLICT: "Alguém alterou essa UC desde a última consulta. Recarregue a versão atual e tente de novo.",
  MISSING_UC_NAME: "O arquivo não traz o nome da UC; preencha o campo Nome.",
  ZA_CREATE_REQUIRES_BATCH: "Não é possível cadastrar uma ZA isolada; use \"Substituir Buffer de Abrangência por ZA oficial\" numa UC existente.",
  DUPLICATE: "Essa importação já foi enviada antes; mostrando o resultado original.",
};
```

### 3.7 Ambiente de desenvolvimento local (sem Docker)

Vale desde o primeiro dia de código (amanhã). O front roda com `npm run dev` (Vite, porta padrão
5173) fora de container, mas ainda precisa falar com a API real do `docker compose` (porta 8000
publicada no host). Configurar o proxy de desenvolvimento do próprio Vite — **nunca CORS na
API**:

```ts
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
```

O navegador continua falando só com `localhost:5173`; o processo do Vite (lado servidor, não o
navegador) que encaminha para `:8000`. Por isso nenhuma configuração de CORS entra na API nem em
desenvolvimento nem em produção (seção 1).

### 3.8 Testes

- **Vitest + React Testing Library**: formulários (validação de campo obrigatório, geração/reuso
  de `Idempotency-Key` conforme 3.5, guarda de rota por papel), e o fluxo real de `UC-CW01`
  contra MSW.
- **MSW (Mock Service Worker)**: mocka `/api/v1/*` nos testes de componente — cobre desde já os
  cenários que só ficam ativos na Fase 2, para poder desenvolvê-los em paralelo sem esperar a API.
- E2E (Playwright) fica como incremento pós-Fase 2, não bloqueia nenhuma das duas entregas.

## 4. Empacotamento Docker

Vale desde a Fase 1 — a demonstração de amanhã sobe assim, não com `npm run dev`.

### 4.1 Dockerfile (multi-stage)

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### 4.2 `nginx.conf`

Config única, já com os cabeçalhos e o `autoindex off` exigidos pela seção 5.3 — não existe uma
segunda cópia "de segurança" separada da cópia "funcional"; deriva risco de as duas divergirem.

```nginx
server_tokens off;   # não anunciar versão do Nginx (mitigação de V4 nesta camada)

server {
    listen 80;

    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'"
      always;

    location /api/ {
        proxy_pass http://protected-areas-sc-api:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location / {
        root /usr/share/nginx/html;
        autoindex off;                # nunca listar diretório (mitigação de V5)
        try_files $uri /index.html;   # SPA: rotas do react-router
    }
}
```

`font-src 'self'` cobre a fonte Inter self-hosted (3.1) — nenhuma fonte externa é carregada.

### 4.3 Entrada no `docker-compose`

Novo serviço, mesma rede externa `pipeline` já usada pela API (`X:\fast-api-protected-areas-sc\compose.yaml`):

```yaml
services:
  frontend:
    build:
      context: .
      target: runtime
    container_name: protected-areas-sc-frontend
    ports:
      - "${FRONTEND_PORT:-3005}:80"
    restart: unless-stopped
    networks:
      - pipeline

networks:
  pipeline:
    external: true
    name: airflow_default
```

O `name: airflow_default` é necessário porque, quando `external: true` não vem acompanhado de
`name`, o Compose procura uma rede Docker com o mesmo nome da chave local (`pipeline`) — mas a
rede real, criada pelo `compose.yaml` do Airflow e já usada pela API (seção 2.5 do repositório da
API), se chama `airflow_default`. Sem essa linha, o serviço do frontend sobe isolado e
`http://protected-areas-sc-api:8000` não resolve.

Fica em repositório próprio (`frontend-protected-areas-sc`, este repositório), assim como
`pipeline-protected-areas-sc` e `fast-api-protected-areas-sc` já são repositórios separados —
mesmo padrão de "um serviço, um repositório, um Dockerfile", consistente com o resto do projeto.

`3005` como padrão, não `3000`, porque a porta `3000` já costuma estar ocupada por outro serviço
local (`juice-shop`) no ambiente de desenvolvimento — subir com `docker compose up` funciona sem
precisar definir `FRONTEND_PORT` manualmente. Ainda assim, sobrescrever com
`FRONTEND_PORT=<porta> docker compose up -d` continua valendo se `3005` também estiver em uso.

## 5. Segurança — regras não negociáveis

Esta seção implementa os requisitos `FE-SEC-01` a `FE-SEC-08` do PRD. Nenhuma regra abaixo é
recomendação genérica de tutorial: cada uma neutraliza uma classe de falha efetivamente
explorada, reproduzida e classificada por CVSS/CWE no trabalho da disciplina de Segurança de
Sistemas do mesmo autor
(`F:\Univali\2026_2\seguranca_sistemas\roteirot_trab_m1\m1-seg-system-diegos`,
achados V1–V7, `relatorio/tabela-de-achados.md`). Onde uma regra só passa a valer na Fase 2
(porque depende de autenticação/mutação reais que não existem na Fase 1), isso está marcado.

### 5.1 Tabela de rastreabilidade achado → mitigação

| Achado (M1) | CWE / CVSS | O que foi explorado | Mitigação aplicada neste projeto | Fase |
|---|---|---|---|---|
| V1 — SQLi no login | CWE-89 / 9.1 Crítico | `' OR 1=1--` no campo de login autenticava sem senha | Toda query em `app_user`/`app_session`/`login_attempt` usa parâmetros vinculados do driver Postgres, nunca f-string/concatenação | 2 |
| V2 — hash de senha exposto no JWT | CWE-522/916 / 6.5–7.5 | Payload de JWT é só Base64 — qualquer um decodifica em F12 → Network ou jwt.io; hash em MD5 sem sal | Sessão opaca em tabela (2.1), não JWT; senha com Argon2; `password_hash` nunca serializado (5.2) | 2 |
| V3 — IDOR na cesta | CWE-639 / 6.5 | Servidor aceitava id de recurso alheio só por o token ser válido, sem checar posse | Toda rota com escopo de usuário deriva o dono/papel da sessão validada no servidor | 2 |
| V4 — erro verboso + CSP/HSTS ausentes | CWE-209, CWE-16 / 5.3 | Cabeçalho malformado devolvia página de erro completa com framework/versão; sem CSP/HSTS | `debug=False` em produção, exception handler genérico com `correlation_id`; headers de segurança obrigatórios (5.3) | **1** (já vale: `UC-CW01` fala com a API real) |
| V5 — listagem de diretório | CWE-548 / 7.5 | `/ftp/` listava arquivos, um confidencial, sem autenticação | Nginx com `autoindex off` (4.2) | **1** (config do Nginx que já sobe amanhã) |
| V6 — força bruta sem bloqueio | CWE-307 / 6.5 | 15 tentativas de senha errada seguidas, todas aceitas, sem bloqueio | Bloqueio progressivo por conta no backend (5.4) | 2 |
| V7 — reset por pergunta de segurança sem limite | CWE-640 / 9.1 Crítico (achado mais grave da disciplina) | Pergunta de segurança adivinhável, tentativas ilimitadas → apropriação total da conta | Sem fluxo de autoatendimento de redefinição de senha; reset é ação direta do administrador | 2 |

### 5.2 "Se eu apertar F12, o que dá pra ver?" — regra de design

Regra geral, válida nas duas fases: **assuma que tudo que chega ao navegador já vazou.** Cookie
`httpOnly` impede leitura por JavaScript/console, mas a aba Network sempre mostra corpo de
requisição e resposta — a pergunta certa não é "como eu escondo isso na tela", é "isso precisava
ter saído do servidor?".

- **DTOs de resposta são allowlist, nunca a entidade crua** (Fase 2): `GET /api/v1/auth/users`
  devolve `UserView` (`id`, `username`, `nome`, `role`, `ativo`, `criado_em`) — `password_hash`
  nunca é serializado. Testável: um teste de contrato falha a build se aparecer.
- **Sem `console.log` de dado sensível em produção** (`esbuild: { drop: ["console", "debugger"] }`
  em `vite.config.ts`) — vale desde a Fase 1.
- **Sem source map público** (`build.sourcemap: false`) — vale desde a Fase 1.
- **Nenhum segredo de servidor com prefixo `VITE_`** — vale desde a Fase 1, mesmo sem segredo
  real ainda: é hábito de codificação, não algo que se lembra de aplicar só quando "importa".
- **Sessão só em cookie `httpOnly`** (Fase 2) — na Fase 1, o mock fica em `sessionStorage`, nunca
  em `localStorage`, e nunca carrega token ou senha, só a escolha local de nome/papel (PRD,
  `FE-SEC-08`).

### 5.3 Cabeçalhos HTTP obrigatórios

Config completa em `nginx.conf` (4.2), ativa desde a Fase 1. `style-src 'unsafe-inline'` é
concessão pragmática do Tailwind/shadcn; `script-src` **não** tem `'unsafe-inline'` nem
`'unsafe-eval'`. `Strict-Transport-Security` entra quando houver TLS de verdade (5.6).

No lado da API, `debug=False` em produção e exception handler genérico (`app/core/errors.py`, já
existente) garantem que nenhuma resposta de erro carregue stack trace ou banner de framework —
já vale hoje, sem mudança nenhuma, porque `UC-CW01` já usa esse caminho.

### 5.4 Bloqueio de força bruta no login (Fase 2)

```sql
CREATE TABLE login_attempt (
    id            BIGSERIAL PRIMARY KEY,
    username      VARCHAR(120) NOT NULL,
    sucesso       BOOLEAN NOT NULL,
    ip_origem     INET,
    criado_em     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_login_attempt_username_time ON login_attempt(username, criado_em);
```

Antes de checar a senha, contar tentativas malsucedidas do mesmo `username` nos últimos 15
minutos; a partir de 5, responder `429`. Fica no backend — bloqueio só no frontend é cosmético e
não existe login real na Fase 1 para proteger.

### 5.5 CSRF (Fase 2)

Sessão em cookie → toda rota de mutação (`POST`/`PATCH`) é alvo potencial de CSRF. Mitigação:
cookie `SameSite=Lax` + exigir `Content-Type: application/json` + CORS fechado por desenho (seção
1). Token CSRF explícito (`double-submit cookie`) fica como incremento se o projeto sair do
ambiente local/demo.

### 5.6 O que fica como risco assumido — registrado, não ignorado

- **TLS/HTTPS**: ambas as fases rodam local/apresentação sem TLS; `Secure` no cookie e
  `Strict-Transport-Security` só fazem sentido com HTTPS real. Ativar antes de qualquer exposição
  fora da rede local.
- **Rate limiting por IP** (além do bloqueio por conta em 5.4) fica para depois da Fase 2.
- **A autenticação mock da Fase 1 não é um risco assumido "menor"** — é ausência total e
  deliberada de controle de acesso, isolada e substituída por completo na Fase 2 (PRD,
  `FE-SEC-08`), nunca uma versão "fraca" de segurança real.

## 6. Testes: unitários e mutação

### 6.1 Backend (Fase 2 — `app/application/auth.py`, `app/infrastructure/persistence/*`)

Unitários (pytest) cobrindo hash/verificação Argon2, geração/expiração/revogação de sessão,
`require_role("admin")` rejeitando `operador` com `403`, contagem/reset de bloqueio de força
bruta (5.4), e que `UserView` nunca serializa `password_hash` (afirmando no JSON real, não só no
tipo declarado).

Mutation testing com `mutmut`, ainda não usado em nenhum dos dois repositórios irmãos:

```toml
[tool.mutmut]
paths_to_mutate = ["app/application/auth.py", "app/infrastructure/persistence/auth_repository.py"]
tests_dir = "tests/"
runner = "python -m pytest -q"
```

### 6.2 Frontend (Fase 1 já cobre o que existe; Stryker entra com o volume de código da Fase 2)

Fase 1: Vitest + RTL cobrindo o fluxo de `UC-CW01` (validação de campo, ciclo de
`Idempotency-Key` de 3.5, política de polling de 3.5, guarda de rota) e a distinção visual
`active`/`coming_soon`/`not_in_api` dos cartões de cenário (3.1/3.5).

Fase 2: Stryker Mutator, escopado às guardas de rota e schemas de validação — onde um operador
trocado (`===`→`!==`, `>`→`<`) é falha de segurança:

```json
{
  "testRunner": "vitest",
  "mutate": ["src/auth/**/*.ts", "src/scenarios/**/*.ts"],
  "thresholds": { "high": 80, "low": 60, "break": 50 }
}
```

## 7. DevSecOps — o que ainda não estava mapeado

A seção 5 cobre o que um usuário vê/explora pelo navegador. Um tech lead DevSecOps também olha a
cadeia de build e a infraestrutura por trás. A maioria destes itens só faz sentido a partir da
Fase 2, porque a Fase 1 não introduz código novo de backend — mas SAST/SCA/secret scanning do
próprio frontend já valem desde o primeiro commit.

| Prática | Estado atual nos repositórios irmãos | O que se recomenda aqui | Fase |
|---|---|---|---|
| SAST Python | `pyproject.toml` da API seleciona só `E, F, I, UP, B` no ruff — sem `S` | Adicionar `"S"` ao `select`, cobrindo o módulo de auth desde o primeiro commit | 2 |
| SAST/lint de segurança do frontend | Não existia frontend até agora | ESLint com `eslint-plugin-security` (ou regra estrita do `typescript-eslint`) no CI | **1** |
| SCA (dependências) | Nenhum scan em nenhum dos dois repositórios | `pip-audit` (API, fase 2) e `npm audit --audit-level=high` (frontend); lockfile sempre commitado | 1 (front) / 2 (API) |
| Secret scanning | Nenhum | `gitleaks` como hook de pre-commit e job de CI nos três repositórios | **1** |
| Scan de imagem de container | Nenhum | Trivy/Grype sobre a imagem final antes de qualquer publicação | 1 |
| Gate de CI | Nenhum `.github/workflows` em nenhum dos dois repositórios | Pipeline mínimo (lint + unitários + SCA + secret scan) bloqueando merge em `main` | 1 |
| Privilégio mínimo no banco | `init_db.sql` sem `CREATE ROLE`/`GRANT` — tudo com a mesma role dona do banco | Dívida pré-existente; role dedicada com `GRANT` restrito, incluindo as tabelas novas de auth | 2 |
| Política de senha | Nenhuma regra além de existir | Comprimento mínimo validado no servidor | 2 |
| Renovação de sessão no login | — | Cada login gera token novo, nunca reaproveita | 2 |
| Cabeçalhos adicionais de isolamento | CSP/X-Frame-Options já em 5.3 | Somar `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy` | 1 |
| Log de evento de segurança | Log operacional com correlation ID já existe | Login malsucedido/bloqueio/criação de conta em linha estruturada `event_type=security` | 2 |
| LGPD sobre dado pessoal | Achados do M1 já classificam por CID/LGPD | Política de retenção de conta desativada — decisão pendente, registrada | 2 |
| HTML não confiável no React | — | Nunca `dangerouslySetInnerHTML` com conteúdo da API; `DOMPurify` se algum dia necessário | 1 e 2 |

## 8. Ordem de implementação

### Fase 1 — amanhã de manhã

1. Scaffold Vite + TypeScript + Tailwind + shadcn/ui (3.1/3.2); `vite.config.ts` já com
   `build.sourcemap: false`, `esbuild.drop` de `console`/`debugger` (5.2) e o proxy de dev (3.7)
   desde o primeiro commit.
2. `AuthContext` + `LocalMockAuthDriver` (3.3); `RequireAuth`/`RequireAdmin`; `LoginPage`.
3. App shell (barra lateral, topo) + as 7 entradas de cenário com `status`
   `active`/`coming_soon`/`not_in_api` (3.1/3.5) — inclusive as 6 desabilitadas, com Badge/Tooltip
   corretos.
4. Formulário de `UC-CW01` real: mapeamento de campos (3.5), `Idempotency-Key` (3.5), envio →
   validação → publicação → `ImportStatusPanel` com polling (3.5) e tradução de erro (3.6).
5. `AdminDashboardPage` mock (`LocalMockUserRepository`) e `HistoricoPage` local — visuais
   completos, claramente locais (5.6).
6. `Dockerfile` + `nginx.conf` (4) com os cabeçalhos de segurança desde o primeiro build
   funcional; entrada no compose.
7. Smoke test manual: subir via `docker compose`, "logar" (mock), navegar pelas 7 entradas de
   cenário, rodar `UC-CW01` até `SUCCEEDED`/`FAILED` de verdade contra a API real, conferir no F12
   → Network que a resposta de erro (se houver) não carrega stack trace.

### Fase 2 — depois, com a API

8. Migração `006_auth_users.sql` (2.2) + módulo `auth` completo (2.1–2.5), incluindo atualizar a
   suíte de testes da API que hoje assume acesso sem sessão (2.5), e o endpoint de busca de UC
   (2.6). Testes unitários (6.1) e primeira rodada de `mutmut` antes de considerar pronto.
9. Trocar `LocalMockAuthDriver`/`LocalMockUserRepository` por `ApiAuthDriver`/chamadas reais —
   sem tocar em `AuthContext`, guardas de rota ou telas (3.3).
10. Habilitar `UC-CW02`/`04`/`07` (`status: "active"`), com o formulário de busca de UC para
    `04`/`07` (2.6).
11. CI mínimo completo (7) nos três repositórios; Stryker (6.2) sobre o volume de código novo.
12. Registrar evidência da execução ponta a ponta.
