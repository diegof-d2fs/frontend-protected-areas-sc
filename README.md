# Frontend — Protected Areas SC

Interface web para operar os cenários de cadastro geoespacial da
[`protected-areas-sc-api`](https://github.com/diisilva/fast-api-protected-areas-sc) sem depender
de Postman/Swagger, com contas nominais (administrador + operador).

## Funcionalidades

- Login com sessão (cookie `HttpOnly`) e dois papéis: administrador e operador.
- Painel de administração de contas (criar, listar, desativar).
- Os sete cenários de cadastro geoespacial (`UC-CW01` a `UC-CW07`) com formulários próprios,
  incluindo busca de UC por CNUC ou WDPA para preencher a versão vigente.

## Executar

```bash
docker compose up -d --build   # http://localhost:3005, com proxy de /api para a API
```

## Documentação

- [`docs/PRD.md`](docs/PRD.md) — o quê e por quê: problema, papéis, histórias de usuário,
  requisitos funcionais e de segurança, fora de escopo do MVP.
- [`docs/SDD.md`](docs/SDD.md) — como: arquitetura, contrato de autenticação, modelo de dados,
  componentização do frontend, empacotamento Docker, testes (unitários e mutação) e práticas
  DevSecOps.

## Repositórios relacionados

- `protected-areas-sc-api` (FastAPI, backend REST + autenticação nova).
- `pipeline-protected-areas-sc` (Airflow, pipelines Medallion e publicação PostGIS).

Este repositório entra na mesma rede Docker externa `pipeline` que os outros dois já usam, como
um serviço a mais (ver `docs/SDD.md`, seção 4).
