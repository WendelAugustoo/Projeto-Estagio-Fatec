# Sistema de Gestão de Estágios Supervisionados

Protótipo funcional de aplicação web para acompanhar processos de **estágio regular**, **equivalência** (experiência profissional) e **equiparação** (atividades acadêmicas), tomando como referência o fluxo documental do Manual para Estágio Supervisionado da CESU/Centro Paula Souza (v2.0.0).

> **Projeto acadêmico demonstrativo.** Não substitui SEI, assinatura eletrônica oficial, portal acadêmico, deliberações da CESU ou processo de aprovação institucional. Todos os dados de exemplo são fictícios. O desenvolvimento deste sistema, por si só, não gera dispensa de estágio.

---

## Sumário

1. [Tecnologias](#tecnologias)
2. [Requisitos para executar](#requisitos-para-executar)
3. [Instalação e execução](#instalação-e-execução)
4. [Credenciais fictícias de teste](#credenciais-fictícias-de-teste)
5. [Roteiro de demonstração](#roteiro-de-demonstração)
6. [Estrutura do projeto](#estrutura-do-projeto)
7. [Perfis e permissões](#perfis-e-permissões)
8. [Workflow e estados](#workflow-e-estados)
9. [Testes automatizados](#testes-automatizados)
10. [Variáveis de ambiente](#variáveis-de-ambiente)
11. [Limitações e diferenças em relação ao escopo](#limitações-e-diferenças-em-relação-ao-escopo)

Documentos complementares:

- [docs/MODELO_DADOS.md](docs/MODELO_DADOS.md) — DER e dicionário de tabelas
- [docs/RASTREABILIDADE.md](docs/RASTREABILIDADE.md) — RF, RN, RNF e critérios de aceite × implementação e evidências
- [docs/api.http](docs/api.http) — coleção de requisições da API (extensão REST Client do VS Code)
- [backend/src/db/schema.sql](backend/src/db/schema.sql) — script de criação do banco
- [backend/src/db/seed.js](backend/src/db/seed.js) — dados de demonstração

---

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + Vite 5 + React Router (SPA responsiva, CSS próprio) |
| Backend | Node.js + Express 4 (API REST) |
| Banco | SQLite (módulo nativo `node:sqlite`, sem dependências nativas para compilar) |
| Autenticação | JWT (Bearer) + senhas com hash bcrypt |
| Uploads | Multer, com validação de extensão, MIME, assinatura binária e tamanho |
| PDF | PDFKit (resumo da solicitação) |
| Testes | `node:test` — testes de aceite contra a API real |

Frontend e backend são **projetos separados** (`frontend/` e `backend/`). O backend concentra todas as regras de negócio e autorizações; o frontend apenas apresenta os dados e as ações que a API informa.

## Requisitos para executar

- **Node.js 22.13 ou superior** (necessário para o módulo `node:sqlite`). Verifique com `node --version`.
- npm (instalado junto com o Node.js).

## Instalação e execução

Na pasta raiz do projeto:

```bash
npm install      # instala as dependências da raiz, do backend e do frontend
npm run dev      # sobe a API (porta 3000) e o frontend (porta 5173) juntos
```

Acesse **http://localhost:5173**.

Na primeira execução o banco `backend/data/estagios.db` é criado e populado automaticamente com dados fictícios.

Outros comandos:

| Comando | O que faz |
|---|---|
| `npm run seed` | Apaga o banco e os uploads e recria os dados de demonstração |
| `npm test` | Executa os testes de aceite do backend |
| `npm --prefix backend run dev` | Só a API |
| `npm --prefix frontend run dev` | Só o frontend |

Para rodar separadamente em dois terminais:

```bash
cd backend && npm install && npm run dev
cd frontend && npm install && npm run dev
```

## Credenciais fictícias de teste

Senha de **todos** os usuários: `Senha@123` (a tela de login também lista as contas — clique para preencher).

| Perfil | E-mail | Situação preparada no seed |
|---|---|---|
| Aluno | `aluno@fatec.demo` | Ana — sem solicitações (ideal para o fluxo completo) |
| Aluno | `aluno.irregular@fatec.demo` | Bruno — matrícula irregular, rascunho de estágio regular completo (CA-01) |
| Aluno | `aluno2@fatec.demo` | Carla — equiparação em análise em curso sem previsão no PPC (CA-07); equivalência deferida parcialmente |
| Aluno | `aluno3@fatec.demo` | Diego — estágio em execução, com horas validadas e pendentes |
| Aluno | `aluno4@fatec.demo` | Elisa — estágio em avaliação final, relatório final aguardando o professor |
| Aluno | `aluno5@fatec.demo` | Felipe — equivalência em conferência pela Secretaria |
| Aluno | `aluno6@fatec.demo` | Gabriel — estágio regular enviado |
| Aluno | `aluno7@fatec.demo` | Isabela — estágio aguardando assinatura da Direção |
| Aluno | `aluno8@fatec.demo` | João — devolvido para correção, **prazo de correção expirado** |
| Aluno | `aluno9@fatec.demo` | Larissa — em conferência, **data de início do estágio já vencida** |
| Secretaria | `secretaria@fatec.demo` | |
| Professor | `professor@fatec.demo` | Prof. Carlos (responsável pela maioria dos casos) |
| Professor | `professora2@fatec.demo` | Profa. Helena |
| Coordenação | `coordenacao@fatec.demo` | |
| Direção | `direcao@fatec.demo` | |
| Administrador técnico | `admin@fatec.demo` | |

## Roteiro de demonstração

Percurso exigido pela especificação (solicitação → análise → correção → parecer → conclusão), usando a aluna **Ana**:

1. **Aluno (`aluno@fatec.demo`)** → *Nova solicitação* → **Estágio regular** → escolha a concedente, preencha o PAE → *Salvar rascunho*.
2. Na tela da solicitação, anexe **TCE** e **PAE** (qualquer PDF/PNG/JPG). Repare que *Enviar* fica bloqueado e explica o que falta enquanto um deles não estiver anexado (CA-02). → *Enviar para conferência*.
3. **Secretaria** → *Minha fila* → abra a solicitação → *Iniciar conferência* → **rejeite** o TCE (ex.: “falta assinatura da concedente”) → *Devolver para correção* com motivo (CA-03).
4. **Aluno** → veja a pendência no painel → anexe o TCE novamente (a versão anterior fica em “Versões anteriores” — CA-04) → *Reenviar após correção*.
5. **Secretaria** → *Retomar análise do reenvio* → marque os documentos como conferidos → em *Formalização do TCE* registre o seguro e as vias assinadas → *Encaminhar para análise acadêmica*, escolhendo **Prof. Carlos**.
6. **Professor** → *Emitir parecer técnico* (favorável) — ou *Devolver para correção* se o PAE for incompatível (CA-05).
7. **Coordenação** → *Aprovar PAE e encaminhar para assinatura*.
8. **Direção** → *Registrar assinatura da Direção (simulação)* — tentar isso antes da etapa é recusado pelo backend (CA-06).
9. **Secretaria** → *Registrar liberação do estágio* → a solicitação entra **Em execução**.
10. Consulte o **Histórico** (ator, data, motivo e transição — CA-11) e *Exportar PDF*.

Para ver a etapa final sem lançar 240 horas: entre como **Prof. Carlos**, abra a solicitação da **Elisa**, aprove o relatório final (ou devolva-o — CA-10) e depois, como **Secretaria**, use *Registrar encerramento do estágio*.

Outros cenários prontos:

- **CA-01** — `aluno.irregular@fatec.demo`: tentar enviar o rascunho mostra o bloqueio por matrícula irregular.
- **CA-07** — `coordenacao@fatec.demo`: na equiparação da Carla, *Registrar decisão* → *Deferido* é recusado (curso sem previsão no PPC).
- **CA-08** — equivalência do Felipe: concluir a conferência, emitir parecer e deferir parcialmente com horas.
- **CA-09** — como Ana, acesse `http://localhost:5173/solicitacoes/7` (do Diego): “não encontrada ou sem permissão”.
- **CA-12** — reduza a janela ou use o modo celular do navegador: tabelas viram cartões, sem rolagem horizontal.
- **Prazo expirado (início)** — `secretaria@fatec.demo`: na fila, a solicitação da **Larissa** tem o selo “Prazo expirado”. Tente *Encaminhar para análise*: fica bloqueado; use *Devolver para correção*.
- **Prazo expirado (correção)** — `secretaria@fatec.demo`: abra a solicitação do **João** (prazo de correção vencido) → *Encerrar por prazo expirado*, com motivo.

## Estrutura do projeto

```
gestao-estagios/
├── package.json              # scripts que sobem front e back juntos
├── backend/                  # API REST
│   ├── src/
│   │   ├── server.js         # inicialização (cria e popula o banco se vazio)
│   │   ├── app.js            # Express, segurança e tratamento de erros
│   │   ├── config.js         # variáveis de ambiente
│   │   ├── routes/           # rotas HTTP (auth, solicitacoes, cadastros)
│   │   ├── services/         # regras de negócio
│   │   │   ├── workflow.js   # máquina de estados (ações, perfis, bloqueios)
│   │   │   ├── regras.js     # regras RN-01..RN-13 (funções puras)
│   │   │   ├── solicitacoes.js # criação, documentos, horas, relatórios
│   │   │   ├── cadastros.js  # usuários, alunos, cursos, concedentes, auditoria
│   │   │   └── pdf.js        # resumo em PDF
│   │   ├── middlewares/      # autenticação/perfil e upload seguro
│   │   └── db/               # schema.sql, conexão e seed
│   ├── tests/aceite.test.js  # testes CA-01..CA-12 e regras
│   ├── uploads/              # arquivos enviados (nome aleatório, fora da área pública)
│   └── data/                 # banco SQLite (gerado)
├── frontend/                 # SPA React
│   └── src/
│       ├── pages/            # Login, Painel, Solicitações, Formulário, Detalhe, Cadastros, Auditoria
│       ├── components/       # Layout, UI comum e blocos da tela de detalhe
│       └── services/         # cliente da API, sessão e formatação
└── docs/                     # DER, rastreabilidade e coleção da API
```

Separação de responsabilidades: **rotas** (HTTP) → **serviços** (regras de negócio e autorização) → **banco** (SQL parametrizado com transações nas alterações críticas).

## Perfis e permissões

| Perfil | Pode |
|---|---|
| Aluno | Criar/editar a própria solicitação (rascunho ou correção), anexar documentos, enviar/reenviar, cancelar, registrar horas, enviar relatórios, acompanhar status e pendências |
| Secretaria | Conferir documentos (aceitar/rejeitar com motivo), registrar seguro e vias assinadas, encaminhar com professor responsável, devolver, indeferir na conferência, liberar o estágio, registrar encerramento, alterar situação de matrícula, cadastrar concedentes |
| Professor | Só vê solicitações em que é o responsável; emite parecer técnico, devolve para adequação, valida horas, avalia relatórios |
| Coordenação | Aprova o PAE (estágio regular) ou decide equivalência/equiparação (integral, parcial ou indeferido, com justificativa); cadastra cursos e define se o PPC prevê equiparação |
| Direção | Registra a assinatura/ciência como **simulação** (sem valor oficial), sempre por último |
| Administrador técnico | Gerencia contas e perfis, consulta solicitações e auditoria; **não** emite nem altera pareceres |

Todas as permissões são verificadas **no backend**, a cada requisição.

## Workflow e estados

```
Rascunho → Enviado → Em conferência → Em análise acadêmica ─┬→ Aguardando assinatura → Formalizado → Em execução → Em avaliação final → Concluído   (regular)
                          │                  │               └→ Deferido | Deferido parcialmente | Indeferido                                    (equivalência/equiparação)
                          │                  │
                          └──────┬───────────┴──── Aguardando correção → Reenviado → (volta para a etapa que devolveu)
                                 └→ Indeferido          ↘ Cancelado
```

- Estados finais (Concluído, Deferido, Deferido parcialmente, Indeferido, Cancelado) não aceitam transições.
- Devoluções feitas na conferência, análise ou assinatura voltam para a **conferência** após o reenvio; devolução do relatório final volta para a **avaliação final**.
- A tela de detalhe mostra cada ação disponível e, quando bloqueada, **o motivo** (ex.: documento faltante, matrícula irregular, assinatura pendente). O servidor revalida tudo ao executar.

### Prazo expirado (exceção da seção 4.1)

O PDF lista “prazo expirado” entre as exceções do fluxo, sem definir valores. O sistema trata três situações, com prazos **configuráveis** (os valores padrão são de demonstração, não normas oficiais):

| Situação | O que o sistema faz |
|---|---|
| **Início do estágio vencido** (estágio regular ainda não formalizado) | Bloqueia *enviar*, *reenviar*, *encaminhar para análise*, *aprovar PAE* e *assinar*. Mostra o selo “Prazo expirado” e orienta a devolver ao aluno para ajustar o período. O TCE precisa ser assinado antes do início, e não há estágio retroativo. Antecedência mínima: `ANTECEDENCIA_MINIMA_DIAS` (padrão 0). |
| **Prazo de correção vencido** | Ao devolver uma solicitação, o sistema define o prazo de correção (`PRAZO_CORRECAO_DIAS`, padrão 15 dias) e mostra “Corrija até DD/MM”. Depois do vencimento aparece o selo “Prazo expirado” e a Secretaria passa a poder **Encerrar por prazo expirado** (cancela com motivo registrado no histórico). O sistema não cancela sozinho: o aluno ainda pode reenviar até a Secretaria decidir. |
| **Período encerrado sem relatório final** | Pendência “Prazo expirado: o período do estágio terminou…” e selo na lista. |

## Testes automatizados

```bash
npm test
```

São 26 testes em `backend/tests/aceite.test.js`, que sobem a API com banco e uploads temporários e cobrem os critérios **CA-01 a CA-12**, além de RN-07, RN-08, RN-10, RN-12, RN-15, prazo expirado, horas, relatórios, PDF e permissões. Resultado esperado: `# pass 26` / `# fail 0`.

O mesmo conjunto roda automaticamente no **GitHub Actions** (`.github/workflows/ci.yml`) a cada push, junto com o build do frontend.

## Variáveis de ambiente

Todas opcionais (há valores padrão para demonstração local):

| Variável | Padrão | Descrição |
|---|---|---|
| `API_PORT` | `3000` | Porta da API (o proxy do Vite usa o mesmo valor) |
| `JWT_SECRET` | valor de desenvolvimento | **Defina em qualquer ambiente publicado** |
| `JWT_EXPIRES_IN` | `8h` | Validade da sessão |
| `DB_FILE` | `backend/data/estagios.db` | Arquivo do banco SQLite |
| `UPLOAD_DIR` | `backend/uploads` | Diretório privado dos anexos |
| `MAX_UPLOAD_MB` | `5` | Tamanho máximo por arquivo |
| `CORS_ORIGIN` | `http://localhost:5173` | Origem(ns) permitidas, separadas por vírgula |
| `PRAZO_CORRECAO_DIAS` | `15` | Dias para o aluno corrigir uma solicitação devolvida |
| `ANTECEDENCIA_MINIMA_DIAS` | `0` | Antecedência mínima entre o envio/formalização e o início do estágio regular |

## Limitações e diferenças em relação ao escopo

**(a) Implementado integralmente:** autenticação e perfis; cadastros de alunos, cursos, concedentes e usuários; solicitação com protocolo interno nas três modalidades; anexos com versionamento; conferência e devolução com motivo; pareceres técnico e acadêmico justificados; máquina de estados com validação por perfil; horas e relatórios parciais/finais; pesquisa por status, curso, aluno e modalidade; histórico e auditoria; PDF; painel operacional; RN-01 a RN-16; CA-01 a CA-12.

**(b) Simplificado para demonstração:**
- Assinaturas do TCE são marcações registradas pela Secretaria e pela Direção (“etapa registrada para fins acadêmicos”), sem valor de assinatura.
- Situação de matrícula e de convênio são informadas manualmente (validação humana).
- Um único perfil de Coordenação atende todos os cursos; não há vínculo coordenador × curso.
- Após o reenvio de uma correção documental ou acadêmica, a solicitação sempre passa de novo pela conferência da Secretaria.
- Reabertura de solicitações encerradas não foi implementada (a especificação prevê apenas “fluxo administrativo explícito”).
- Intervalo de relatórios parciais calculado em blocos de 183 dias (≈ 6 meses).
- Os prazos (15 dias para correção, antecedência mínima 0) são valores de demonstração e devem ser definidos pela instituição.

**(c) Integrações representadas por dados fictícios:** SEI, sistema acadêmico, cadastro de convênios, SSO e assinatura digital **não** são integrados.

**(d) Não entregue (evolução opcional da especificação):** notificações por e-mail, SSO, integrações externas, dashboard analítico avançado.

**(e) Riscos e próximos passos:** usar dados reais exigiria adequação à LGPD (base legal, retenção, aviso de privacidade), hospedagem homologada, HTTPS, segredo JWT forte, backup e revisão de segurança; evoluir para banco PostgreSQL em cenário multiusuário; notificações ao aluno e responsáveis.
