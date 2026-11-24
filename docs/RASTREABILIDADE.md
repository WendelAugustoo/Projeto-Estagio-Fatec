# Rastreabilidade: requisitos × implementação × evidências

Legenda de evidência: **T** = teste automatizado em `backend/tests/aceite.test.js` (`npm test`); **D** = demonstrável na interface (ver roteiro no README).

## Requisitos funcionais

| ID | Requisito | Implementação | Evidência |
|---|---|---|---|
| RF-01 | Autenticar e restringir por perfil | `routes/auth.js`, `middlewares/auth.js` (JWT + `exigirPerfil`), `contexto.podeVisualizar` | T (login inválido, sem token, aluno em /usuarios), D |
| RF-02 | Cadastro de estudante, curso e concedente | `services/cadastros.js`, tela **Cadastros** | D |
| RF-03 | Criar, editar e enviar por modalidade | `solicitacoes.criar/atualizar`, ação `enviar`; tela **Nova solicitação** | T (CA-02, CA-08), D |
| RF-04 | Receber e consultar anexos | `solicitacoes.anexarDocumento/obterArquivo`, `middlewares/upload.js` | T (RN-15, CA-04), D |
| RF-05 | Conferir documentação e devolver pendências | `conferirDocumento`, ação `devolver` | T (CA-03), D |
| RF-06 | Parecer técnico e acadêmico justificado | ações `parecer_tecnico`, `aprovar_plano`, `decidir`, `indeferir` | T (CA-05, CA-08), D |
| RF-07 | Transições por regra e perfil | `services/workflow.js` (`ACOES`, `executarAcao`) | T (CA-06, RN-07), D |
| RF-08 | Execução, horas e relatórios | `registrarHoras`, `validarHoras`, `enviarRelatorio`, `avaliarRelatorio` | T (horas, CA-10), D |
| RF-09 | Pesquisar por status, curso e aluno | `solicitacoes.listar` (filtros status, modalidade, curso, aluno/matrícula/protocolo, fila) | D |
| RF-10 | Trilha de auditoria | tabelas `historico_status` e `auditoria`; tela **Auditoria** | T (CA-11), D |
| RF-11 | Exportar resumo em PDF | `services/pdf.js`, `GET /solicitacoes/:id/pdf` | T (PDF), D |
| RF-12 | Dashboard operacional | `GET /dashboard`, tela **Painel** (indicadores, fila, por situação/modalidade, pendências do aluno) | T (CA-12 backend), D |

## Regras de negócio

| ID | Regra | Onde |
|---|---|---|
| RN-01 | Matrícula irregular bloqueia estágio regular | `regras.regraMatricula` (envio, reenvio e encaminhamento) — T CA-01 |
| RN-02 | Modalidade e curso antes de abrir | `solicitacoes.criar` |
| RN-03 | TCE e PAE exigidos; vias e assinaturas registradas | `regraDocumentos`, campos `ass_*` (tela Formalização) |
| RN-04 | Não encaminhar com documentação incompleta | `regraConferenciaDocumentos` — T CA-02/CA-05 |
| RN-05 | PAE com atividades, técnicas, duração e compatibilidade | `regraDadosPlano` |
| RN-06 | PAE incompatível devolvido com justificativa | `devolver` em análise gera parecer técnico AJUSTES_NECESSARIOS — T CA-05 |
| RN-07 | Direção assina por último | `regraAssinaturasAnteriores` — T |
| RN-08 | Seguro registrado pela Secretaria, nunca pelo aluno | `atualizarConferencia` (somente SECRETARIA), `regraSeguro` — T |
| RN-09 | Relatório a cada ≤ 6 meses; parcial e final | `parciaisExigidos`, `regraRelatoriosParaAvaliacao`, pendência de relatório vencido |
| RN-10 | Um estágio regular ativo por vez | `regraEstagioAnterior` — T |
| RN-11 | Equivalência com comprovação, descrição e carga horária | `regraDadosPlano`, documentos obrigatórios |
| RN-12 | Equiparação só se prevista no PPC | `decidir.validar` (`curso.permite_equiparacao`) — T CA-07 |
| RN-13 | Integral, parcial ou indeferido com justificativa | `decidir` — T CA-08 |
| RN-14 | Só perfis autorizados mudam estado; tudo auditado | `executarAcao`, `registrarTransicao`, `audit` — T |
| RN-15 | Upload validado (formato, tamanho, tipo, titularidade) | `middlewares/upload.js` (extensão + MIME + assinatura binária + 5 MB), tipos por modalidade — T |
| RN-16 | Sem assinatura oficial, convênio automático ou SEI | Avisos na interface, no PDF e no README |

## Requisitos não funcionais

| ID | Como foi atendido |
|---|---|
| RNF-01 Segurança | bcrypt, JWT com expiração, autorização no backend em toda rota, download de anexos só após verificar visibilidade, arquivos com nome aleatório fora da área pública, limite de tentativas de login, SQL parametrizado, cabeçalhos `nosniff`/`X-Frame-Options` |
| RNF-02 Privacidade | Somente dados fictícios; mensagens de login genéricas; aluno e professor só veem o que lhes pertence |
| RNF-03 Interface | Layout responsivo, mensagens de sucesso/erro, ações bloqueadas explicam o motivo |
| RNF-04 Acessibilidade | HTML semântico, rótulos ligados aos campos, foco visível, link “Ir para o conteúdo”, modais com foco e Esc, `aria-live`/`role=alert`, status com texto e não só cor |
| RNF-05 Integridade | Chaves estrangeiras, `CHECK`, `UNIQUE`, transações nas operações críticas |
| RNF-06 Auditabilidade | `historico_status` (ator, ação, data/hora, motivo, anterior/novo) + `auditoria` com antes/depois |
| RNF-07 Qualidade | `npm install && npm run dev`; seed automático; erros padronizados `{error:{code,message,details}}` |
| RNF-08 Manutenibilidade | Rotas → serviços → banco; regras puras em `regras.js`; configuração por variáveis de ambiente |

## Critérios de aceite

| Cenário | Resultado | Teste |
|---|---|---|
| CA-01 matrícula irregular | Envio bloqueado com explicação | `CA-01` ✔ |
| CA-02 TCE sem PAE | Documento faltante identificado; permanece em rascunho | `CA-02` ✔ |
| CA-03 falta de assinatura | “Aguardando correção” com motivo | `CA-03` ✔ |
| CA-04 reenvio | Nova versão; anterior preservada como substituída | `CA-04` ✔ |
| CA-05 PAE incompatível | Volta para correção com parecer justificado | `CA-05` ✔ |
| CA-06 Direção antes da análise | Backend recusa (422) | `CA-06` ✔ |
| CA-07 equiparação sem PPC | Deferimento bloqueado | `CA-07` ✔ |
| CA-08 reconhecimento parcial | Horas e justificativa registradas | `CA-08` ✔ |
| CA-09 processo de outro aluno | 404 em detalhe, PDF, download e horas | `CA-09` ✔ |
| CA-10 relatório final devolvido | Pendência no painel; conclusão bloqueada; fluxo de correção até concluir | `CA-10` ✔ |
| CA-11 mudança de status | Histórico com ator, data, motivo e transição | `CA-11` ✔ |
| CA-12 tela estreita | Tabelas em cartões; sem rolagem horizontal (verificado em 375 px) | D |

Resultado da última execução: **22 testes, 22 aprovados, 0 falhas**.
