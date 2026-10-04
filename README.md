# Frontend — Protected Areas SC

Interface web para operar os cenários de cadastro geoespacial da
[`protected-areas-sc-api`](https://github.com/diegof-d2fs/fast-api-protected-areas-sc) sem depender
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

- [fast-api-protected-areas-sc](https://github.com/diegof-d2fs/fast-api-protected-areas-sc) (FastAPI, backend REST + autenticação).
- [pipeline-protected-areas-sc](https://github.com/diegof-d2fs/pipeline-protected-areas-sc) (Airflow, pipelines Medallion e publicação PostGIS).

Este repositório entra na mesma rede Docker externa `pipeline` que os outros dois já usam, como
um serviço a mais (ver `docs/SDD.md`, seção 4).


## CI/CD na AWS

O workflow [.github/workflows/ci.yml](.github/workflows/ci.yml) executa lint e build em
pushes no main e pull requests. Depois do build, um push no main publica o artefato dist
no bucket do frontend e invalida o cache do CloudFront.

Variáveis de repositório exigidas: AWS_DEPLOY_ROLE_ARN, FRONTEND_BUCKET e
CLOUDFRONT_DISTRIBUTION_ID. O papel vem do módulo ci da infraestrutura e recebe
credenciais temporárias por GitHub OIDC, com confiança restrita a este repositório
na branch main. index.html é publicado sem cache; os assets com hash usam cache
imutável. A publicação é conferida em https://areasprotegidas-sc.com.
