# PRD — Frontend de gestão geoespacial (Protected Areas SC)

## 1. Contexto

A `protected-areas-sc-api` (FastAPI) já implementa, ponta a ponta, quatro dos sete casos de uso
de interface definidos no TCC 2/TCC 3 (`UC-CW01`, `UC-CW02`, `UC-CW04`, `UC-CW07`), com o
caminho de escrita único `API → Bronze → Airflow → PostGIS → derivados temáticos`. Hoje o único
cliente é o Swagger/Postman (`docs/GUIA_TESTES_POSTMAN.md`), documentado no próprio README da API
como estado temporário: "a interface web visual ainda será implementada sobre esse contrato".

Este documento define o produto deste frontend em duas fases deliberadas (seção 2) — uma entrega
de demonstração primeiro, o produto completo depois — porque a próxima necessidade real é mostrar
ao orientador uma interface visual completa, buildada, com pelo menos um cenário funcionando de
ponta a ponta, antes de investir no módulo de autenticação inteiro.

## 2. Fases de entrega

### Fase 1 — MVP de demonstração

Objetivo: uma interface **visualmente completa** (todas as telas, papéis e cenários do desenho
final existem e navegam) em que **um cenário funciona de verdade, ponta a ponta, contra a API
real** — `UC-CW01` (cadastrar UC, uma ou várias, via ZIP/GeoJSON/KML). Escolhido porque é o único
cenário que **não exige nenhuma mudança na API**: já está implementado e testado hoje.

O que é real na Fase 1:

- o formulário de `UC-CW01`, do upload até `SUCCEEDED`/`FAILED`, contra `POST /api/v1/imports`,
  `GET /imports/{id}/validation`, `POST /imports/{id}/publish` e polling de
  `GET /imports/{id}` — nenhum mock nesse caminho;
- o container Docker do frontend (Nginx + build do React), do jeito que vai para produção.

O que é maquete deliberada na Fase 1 — visível, navegável, mas não ligada a nada real, e **nunca
apresentada como se fosse real**:

- login e sessão: autenticação **local, no navegador**, sem chamar API nenhuma (seção 3 do SDD);
- painel de administração: lista/criação de conta opera sobre estado local, não persiste no
  servidor;
- `UC-CW02`, `UC-CW04`, `UC-CW07`: já existem na API, mas ficam **desabilitados nesta fase por
  decisão de escopo da demonstração**, não porque faltem na API — mesmo tratamento visual que
  `UC-CW03`/`UC-CW05`/`UC-CW06` (que faltam de verdade);
- histórico de importações (`US-12`): guardado só no navegador (sem sessão real, não existe "por
  usuário" ainda no servidor).

Essa é uma decisão de **sequência de implementação**, não uma mudança do escopo final.

### Fase 2 — produto completo

Tudo que a Fase 1 deixou de mock vira real: módulo de autenticação na API (`docs/SDD.md`, seção
2), `UC-CW02`/`UC-CW04`/`UC-CW07` habilitados de verdade, painel de administração contra a API,
histórico por usuário persistido, e `UC-CW03`/`UC-CW05`/`UC-CW06` entram assim que a API os
implementar. A Fase 2 é o escopo já detalhado no restante deste documento e do SDD; onde um
requisito vale só para uma fase, isso está marcado explicitamente.

## 3. Problema e objetivo

**Problema:** hoje, publicar ou atualizar uma UC/ZA exige montar manualmente uma requisição
multipart no Postman/Swagger, conhecer o contrato de `domain`/`operation`/`metadata` e ler a
resposta JSON para saber se deu certo. Isso não escala para outra pessoa operar o cadastro sem
apoio técnico direto, nem é algo que se mostre a um orientador como produto.

**Objetivo do produto (Fase 2 completa):** uma página web simples, em formulário, autenticada,
onde:

1. o administrador (o autor do TCC) entra com sua conta e tem acesso a um painel próprio para
   criar/gerenciar contas de outras pessoas;
2. qualquer pessoa autenticada (administrador ou operador) acessa um formulário para executar os
   cenários de cadastro geoespacial já implementados na API e acompanhar o resultado até o estado
   final, sem precisar ler JSON bruto ou montar requisições manualmente.

## 4. Fora de escopo

### Fora de escopo definitivo (nenhuma das duas fases)

- Permissões granulares por cenário (ex.: "este operador só pode atualizar, não pode criar"). Só
  dois papéis fixos: administrador e operador.
- Autoatendimento de conta (cadastro público) e recuperação de senha por e-mail — não há
  infraestrutura de e-mail no projeto. O administrador define/reseta a senha diretamente.
- Qualquer tela para PRODES, MapBiomas, MapBiomas Alerta ou FIRMS — esses domínios não são
  entrada da API (`ATCC-023`) e não têm cenário de interface no TCC.
- Internacionalização (só pt-BR) e layout mobile-first pixel perfect — a ferramenta é de uso
  interno, em desktop, ainda que responsiva o suficiente para não quebrar em telas estreitas
  (`docs/SDD.md`, seção 3.1.1). Tema escuro deixou de estar fora de escopo: a Fase 1 implementa um
  alternador de tema (escuro por padrão, claro por escolha explícita), ver `docs/SDD.md` seção 3.1.
- `za_oficial/create` isolado — bloqueado por desenho na própria API
  (`ZA_CREATE_REQUIRES_BATCH`); não existe cenário de "subir ZA do zero" sem UC associada. O que
  existe é `UC-CW07`, que **substitui** o Buffer de Abrangência de uma UC já cadastrada por uma ZA oficial.

### Fora de escopo só da Fase 1 (volta na Fase 2)

- `UC-CW02` (criar UC pontual), `UC-CW04` (atualizar UC) e `UC-CW07` (substituir Buffer de Abrangência por ZA
  oficial) — já implementados na API, mas fora do formulário funcional desta fase por decisão de
  escopo da demonstração. Aparecem desabilitados, com aviso "disponível na próxima etapa", **não**
  "não implementado na API" (esse texto é só para `CW03`/`CW05`/`CW06`, que é verdade lá).
- Login/sessão/papel real, painel de administração real, histórico real por usuário.

### Fora de escopo até a API implementar (`UC-CW03`, `UC-CW05`, `UC-CW06`)

- **`UC-CW03`** (criar UC + ZA oficial juntas, lote atômico) — API ainda não implementa
  `/import-batches`.
- **`UC-CW05`** (extinção de UC — "deletar") — API não tem esse endpoint/operação hoje.
- **`UC-CW06`** (substituir ponto por polígono) — idem.

Nos três casos, o formulário deixa a opção **visível e desabilitada**, com aviso "ainda não
implementado na API" — mantém o desenho dos 7 cenários rastreável para a banca sem prometer uma
função inexistente.

## 5. Usuários e papéis

| Papel | Quem | Acesso |
|---|---|---|
| **Administrador** | Só o autor do TCC nesta fase (conta única, pode criar outras) | Painel de administração (listar, criar, desativar/reativar e redefinir senha de contas) **+** formulário de cenários, igual a um operador |
| **Operador** | Pessoas convidadas pelo administrador | Somente o formulário de cenários. Sem acesso ao painel de administração, sem visão de outras contas |

Não existe autocadastro. Toda conta nasce criada pelo administrador pelo próprio painel. Na Fase
1, "criada pelo administrador" é uma simulação local (seção 2); o modelo de papéis e a navegação
são os mesmos que a Fase 2 vai usar de verdade — só a fonte da sessão muda.

## 6. Histórias de usuário

### Administrador (Fase 2 real; Fase 1 simulada localmente)

- **US-01** Como administrador, eu entro com usuário e senha e sou redirecionado para o painel
  de administração (não para o formulário), porque meu papel me dá acesso extra.
- **US-02** Como administrador, eu crio uma conta de operador informando nome, e-mail/usuário e
  uma senha inicial, para que essa pessoa possa operar o formulário de cenários.
- **US-03** Como administrador, eu vejo a lista de contas existentes (nome, papel, status
  ativo/inativo, data de criação), para saber quem tem acesso.
- **US-04** Como administrador, eu desativo uma conta (sem excluir o registro, preservando
  histórico de quem publicou o quê), para revogar acesso sem perder rastreabilidade — mesmo
  princípio de "vigência sem exclusão física" já usado no resto do projeto para UC/ZA. Uma conta
  desativada pode ser reativada; não existe exclusão física de conta em nenhuma das duas fases,
  pelo mesmo motivo. Eu também redefino a senha de uma conta (a pessoa recebe uma senha nova; a
  conta não escolhe a própria senha na criação).
- **US-05** Como administrador, eu também acesso o formulário de cenários (US-06 a US-12), porque
  meu papel inclui tudo que um operador pode fazer. A única diferença de acesso entre os dois
  papéis é o painel de administração; nenhum cenário de cadastro é exclusivo de um papel.

### Administrador ou operador

- **US-06** Como usuário autenticado, eu entro com usuário e senha e sou redirecionado para o
  formulário de cenários. *(Fase 1: autenticação local, sem API.)*
- **US-07 — Fase 1 real** Como usuário autenticado, eu escolho o cenário "Cadastrar UC nova"
  (`UC-CW01`), envio um arquivo (Shapefile ZIP, GeoJSON ou KML) com uma ou mais UCs, preencho os
  metadados exigidos (fonte; nome só se o arquivo não trouxer), escolho a política de duplicidade
  (`reject_batch`/`skip_duplicates`) e envio.
- **US-08 — Fase 2** Como usuário autenticado, eu escolho o cenário "Cadastrar UC sem polígono"
  (`UC-CW02`), envio um arquivo com exatamente um ponto e os metadados mínimos.
- **US-09 — Fase 2** Como usuário autenticado, eu escolho o cenário "Atualizar geometria de UC
  existente" (`UC-CW04`), busco a UC pelo identificador forte (`cd_cnuc`/`wdpa_pid`/outro) — a
  tela mostra a versão vigente encontrada, eu não digito esse número de cabeça —, informo a
  justificativa e o novo arquivo, e recebo um erro claro se a versão mudou entre a busca e o
  envio (conflito de concorrência), sem me obrigar a interpretar o código de erro bruto da API.
- **US-10 — Fase 2** Como usuário autenticado, eu escolho o cenário "Substituir Buffer de Abrangência por ZA
  oficial" (`UC-CW07`), informo o identificador da UC, a justificativa e o arquivo da ZA oficial
  (polígono).
- **US-11 — Fase 1 real para CW01, mesmo padrão vale para os demais quando entrarem** Como
  usuário autenticado, depois de enviar qualquer cenário, eu acompanho o andamento (`PROCESSING`
  → `SUCCEEDED`/`FAILED`) sem precisar atualizar a página manualmente, e vejo mensagens de erro
  traduzidas para linguagem de negócio quando falha (ex.: "Essa UC já existe" em vez de
  `UC_ALREADY_EXISTS`).
- **US-12 — Fase 1 local/sessão; Fase 2 persistido por usuário** Como usuário autenticado, eu
  vejo minhas últimas importações enviadas (histórico simples: cenário, arquivo, data, estado
  final), para conferir o que já publiquei sem precisar anotar em outro lugar.

## 7. Requisitos funcionais

| ID | Requisito | Fase |
|---|---|---|
| FE-RF-01 | O sistema deve exigir "login" para qualquer tela além da de login. | 1 (local) / 2 (real) |
| FE-RF-02 | O sistema deve distinguir papel `admin` e `operador` e redirecionar após login conforme o papel (US-01/US-06). | 1 e 2 |
| FE-RF-03 | Somente contas `admin` podem acessar a tela de criação de conta; não alcançável por um operador, nem por URL direta. | 1 e 2 |
| FE-RF-04 | O painel de administração deve listar, criar, desativar/reativar e redefinir a senha de contas (US-02 a US-04). Nenhuma conta é excluída fisicamente, nas duas fases. | 1 (local) / 2 (real) |
| FE-RF-05 | O formulário de cenários deve exibir os 7 cenários do TCC; só `UC-CW01` habilitado na Fase 1. | 1 |
| FE-RF-05b | Na Fase 2, o formulário habilita também `UC-CW02`, `UC-CW04` e `UC-CW07`. | 2 |
| FE-RF-06 | Os cenários não habilitados na fase corrente aparecem na lista, visivelmente desabilitados, com aviso apropriado ("disponível na próxima etapa" para `CW02`/`04`/`07` na Fase 1; "ainda não implementado na API" para `CW03`/`05`/`06` em qualquer fase). | 1 e 2 |
| FE-RF-07 | Cada formulário de cenário deve validar no cliente os campos obrigatórios do contrato antes de habilitar o envio. | 1 e 2 |
| FE-RF-08 | O sistema deve gerar a `Idempotency-Key` automaticamente uma vez por tentativa de envio (não a cada clique de "enviar"); reenviar a mesma tentativa depois de uma falha reaproveita a mesma chave e o mesmo arquivo; só escolher um arquivo novo ou reiniciar o formulário gera uma chave nova (ver SDD, 3.3). | 1 e 2 |
| FE-RF-09 | Após o envio, o sistema acompanha o estado da importação por polling (intervalo inicial 1,5s, backoff até 10s, teto de 5 minutos) até um estado terminal ou até o teto; ao atingir o teto, para de atualizar sozinho, mostra aviso e mantém a importação visível no histórico para conferência manual. | 1 e 2 |
| FE-RF-10 | O sistema mantém, por usuário, um histórico local das últimas importações enviadas (US-12). | 1 (sessão do navegador) / 2 (persistido por usuário) |
| FE-RF-11 | Erros da API em `application/problem+json` devem ser mapeados para mensagens em português, com fallback genérico para códigos não mapeados. | 1 e 2 |

## 8. Requisitos não funcionais

| ID | Requisito |
|---|---|
| FE-RNF-01 | Interface e mensagens em português (pt-BR). |
| FE-RNF-02 | Uso interno, desktop-first; responsividade básica é desejável, não é critério de aceite. |
| FE-RNF-03 | Sessão de login não deve expor token em `localStorage` **na Fase 2**; ver SDD para desenho de sessão real. Na Fase 1 não existe token nenhum para expor — a "sessão" é só estado de UI local, e isso deve ficar visível no código como tal (ver FE-SEC-08). |
| FE-RNF-04 | Toda ação de mutação real (Fase 1: só `UC-CW01`) deve ficar auditável do lado da API (quem fez, quando) assim que houver identidade autenticada real para carimbar — na Fase 1 isso não se aplica, porque não há identidade autenticada real. |
| FE-RNF-05 | O frontend não deve reimplementar nenhuma regra de negócio geoespacial (CRS, validação de geometria, duplicidade) — toda validação de domínio continua exclusiva da API, o frontend só valida forma/obrigatoriedade de campo. |
| FE-RNF-06 | Rodar como serviço Docker dedicado, na mesma rede `pipeline` externa dos demais serviços do projeto — vale desde a Fase 1. |
| FE-RNF-07 | Nenhuma chamada do navegador cruza origem: em desenvolvimento local, o proxy de dev do Vite encaminha `/api` para a API; em container, o Nginx faz o mesmo por reverse proxy. A API nunca precisa habilitar CORS para nenhuma origem, em nenhuma das duas fases. |

## 9. Critérios de aceite

### Fase 1 (demonstração)

1. A aplicação sobe via `docker compose up` como serviço próprio, com build de produção do React
   servido por Nginx — não é `npm run dev` rodando ao vivo na demonstração.
2. Login (mock local) funciona, redireciona conforme papel, e o painel de administração e as 7
   entradas de cenário estão todos visíveis e navegáveis.
3. `UC-CW01` funciona de ponta a ponta contra a API real: upload, validação, publicação, polling
   e resultado final (`SUCCEEDED`/`FAILED`) na tela, sem usar Postman.
4. Um erro conhecido da API nesse fluxo (ex.: `UC_ALREADY_EXISTS`) aparece traduzido, não como
   JSON bruto.
5. Os outros 6 cenários aparecem desabilitados, com o aviso correto para cada motivo (seção 4),
   sem quebrar a navegação.
6. Nenhuma tela finge que uma ação mock (login, criar conta, histórico) é uma chamada real —
   qualquer indicação visual de "salvo"/"criado" nessas telas deixa claro que é local desta sessão.

### Fase 2 (produto completo)

1. Critérios de aceite da Fase 1, mais:
2. Um administrador consegue: logar de verdade, criar uma conta de operador de verdade, deslogar;
   o operador criado consegue logar com a senha definida e **não** vê o painel de administração.
3. `UC-CW02`, `UC-CW04` e `UC-CW07` funcionam de ponta a ponta pela interface, incluindo a busca
   de UC por identificador forte para `CW04` (ver US-09, SDD seção 2.6); `CW07` envia o
   `uc_identifier` diretamente, conforme seu contrato de importação dirigida.
4. O histórico passa a ser por conta, persistido no servidor.

## 10. Requisitos de segurança (o que o produto garante)

Estas regras não são recomendação genérica de mercado: cada uma neutraliza uma classe de falha
que foi efetivamente explorada, reproduzida e classificada por CVSS/CWE no trabalho da disciplina
de Segurança de Sistemas do mesmo autor
(`F:\Univali\2026_2\seguranca_sistemas\roteirot_trab_m1\m1-seg-system-diegos`,
`relatorio/tabela-de-achados.md`, achados V1–V7). O detalhamento técnico de cada mitigação está
em `docs/SDD.md`, seção 5; aqui ficam os requisitos do ponto de vista do produto — o que o
sistema **garante**, não como. Todos valem a partir da Fase 2 (quando existe autenticação e
mutação reais além de `UC-CW01`); a ressalva de cada um sobre a Fase 1 está explícita.

| ID | Requisito | Achado que motiva |
|---|---|---|
| FE-SEC-01 | Nenhum dado sensível (hash de senha, segredo, corpo de erro interno) pode aparecer em qualquer resposta HTTP visível na aba Network do navegador (F12), nem em `localStorage`/`sessionStorage`/console. Na Fase 1 não existe senha real nem segredo para vazar — a regra passa a valer no momento em que a Fase 2 introduz credenciais de verdade. | V2 — hash de senha (MD5) vazado no payload do JWT, trivialmente decodificável em qualquer decodificador Base64/jwt.io. |
| FE-SEC-02 | Toda decisão de autorização (quem vê o quê, quem pode fazer o quê) é resolvida no backend a partir da sessão validada no servidor a partir da Fase 2 — nunca a partir de um valor enviado pelo cliente, e nunca apenas por a interface esconder um botão ou link. Na Fase 1, como não há dado real por trás de nenhuma tela além de `UC-CW01` (que não tem escopo de usuário), não há autorização real para quebrar — mas o código já deve estar estruturado para trocar o mock pela checagem real sem reescrever os componentes. | V3 — IDOR: o servidor aceitava acessar um recurso de outro usuário só porque o token era válido, sem checar posse do recurso. |
| FE-SEC-03 | Erros retornados ao navegador nunca contêm stack trace, nome/versão de framework nem detalhe de infraestrutura interna; o detalhe técnico fica só no log do servidor, correlacionado por um identificador reportável pelo usuário. Já vale na Fase 1, porque `UC-CW01` já fala com a API real. | V4 — cabeçalho malformado provocava página de erro completa expondo `Express ^4.22.1`. |
| FE-SEC-04 | Nenhum diretório do servidor (estático ou de dados) é listável publicamente; todo caminho servido é um arquivo explicitamente esperado pela aplicação. Vale desde a Fase 1 (é configuração do Nginx do container, que já sobe nesta fase). | V5 — listagem de diretório expôs um documento marcado "confidencial", sem autenticação. |
| FE-SEC-05 | O login tem proteção contra força bruta, aplicada no backend, a partir da Fase 2 (quando existe um backend de login de verdade para atacar). | V6 — 15 tentativas de senha errada seguidas foram todas aceitas, sem bloqueio nem atraso. |
| FE-SEC-06 | Não existe, e não está planejado, nenhum fluxo de redefinição de senha por pergunta de segurança nem qualquer segredo de baixa entropia adivinhável; redefinir senha é sempre uma ação direta do administrador (US-04/painel), a partir da Fase 2. | V7 — pergunta de segurança sem limite de tentativas permitiu apropriação total de conta; **achado mais crítico da disciplina (CVSS 9.1)**. |
| FE-SEC-07 | Toda consulta às tabelas novas de autenticação usa parâmetros vinculados, nunca concatenação de string — sem exceção, desde a primeira linha de código da Fase 2. | V1 — SQL Injection no login (`' OR 1=1--`) autenticava sem senha; **CVSS 9.1**, achado didático mais citado da disciplina. |
| FE-SEC-08 | A autenticação mock da Fase 1 deve ser tecnicamente impossível de confundir com autenticação real: isolada num módulo próprio (`authDriver` local), sem nenhum caminho de código que a apresente como controle de acesso de verdade, e removida — não desativada por flag — quando a Fase 2 substituir o driver. Nenhuma decisão de segurança do produto pode depender do mock continuar existindo. | Achado geral do M1: um controle de acesso que parece existir mas não protege nada (a UI escondia elementos sem o servidor checar) é pior do que a ausência visível de controle, porque cria falsa sensação de segurança. |

## 11. Riscos e dependências

- **Sem dependência bloqueante para a Fase 1** — `UC-CW01` já está implementado na API; nenhuma
  mudança de backend é necessária para a demonstração de amanhã.
- **Dependência bloqueante para a Fase 2:** o backend de autenticação (login, papéis, criação de
  conta) não existe hoje na API; `docs/SDD.md` (seção 2) tem o contrato completo a implementar
  antes de qualquer tela deixar de ser mock. A mesma entrega de Fase 2 também precisa: proteger
  `/imports` e `/ucs` com sessão (e atualizar a suíte de testes existente da API, que hoje assume
  acesso sem sessão), adicionar a busca de UC por identificador forte (SDD, 2.6), e carimbar a
  identidade autenticada na auditoria de domínio (`cadastral_event.ator`).
- **Risco de escopo:** o usuário final (você) também é o único administrador hoje; qualquer
  decisão de "múltiplos administradores" fica para depois da Fase 2.
- **Risco de rastreabilidade acadêmica:** como os 7 casos de uso do TCC já são um contrato
  formal, qualquer divergência de nome ou
  fluxo entre este PRD e esses documentos deve ser registrada como ajuste rastreável, não só
  corrigida silenciosamente no front. A divisão em fases deste documento não é uma dessas
  divergências (seção 2).
- **Risco de apresentação:** se a Fase 1 for demonstrada sem deixar claro, na hora, quais telas
  são mock, o orientador pode entender como "pronto" algo que não é. Recomendação: dizer
  explicitamente, na demonstração, que só `UC-CW01` fala com o servidor.
