# Evidências de validação

Capturas de tela do sistema funcionando, ligadas ao requisito ou critério de aceite que cada uma comprova (seção 12 da especificação). Todas usam dados fictícios do seed (`npm run seed`). Os testes automatizados que cobrem os mesmos cenários estão em `backend/tests/aceite.test.js` (print 23).

| # | Cenário | Comprova | Resultado observado |
|---|---|---|---|
| 01 | Tela de login com contas fictícias | RF-01 | Autenticação por perfil; mensagens genéricas de erro |
| 02 | Painel da Secretaria | RF-12 | Indicadores, fila de trabalho, gráficos por situação e modalidade |
| 03 | Fila com selo “Prazo expirado” | Seção 4.1 | Solicitações com prazo vencido destacadas |
| 04 | Prazo de correção vencido (João) | Seção 4.1 | Pendência e ação “Encerrar por prazo expirado” |
| 05 | Início do estágio vencido (Larissa) | Seção 4.1 | Encaminhamento bloqueado por prazo expirado |
| 06 | Matrícula irregular (Bruno) | CA-01, RN-01 | Envio bloqueado com explicação |
| 07 | Equiparação sem previsão no PPC (Carla) | CA-07, RN-12 | Deferimento recusado pelo backend |
| 08 | Aluno abre processo de outro aluno | CA-09 | “Não encontrada ou sem permissão” |
| 09 | Nova solicitação (formulário do PAE) | RF-03, RN-05 | Formulário por modalidade |
| 10 | TCE sem PAE | CA-02, RN-03 | Envio bloqueado: documento obrigatório ausente |
| 11 | Secretaria rejeita TCE e devolve | CA-03, RF-05 | “Aguardando correção” com motivo |
| 12 | Reenvio com nova versão | CA-04 | Nova versão; anterior em “Versões anteriores” |
| 13 | Professor devolve PAE incompatível | CA-05, RN-06, RF-06 | Parecer técnico “Ajustes necessários” com justificativa |
| 14 | Histórico da solicitação | CA-11, RF-10 | Ator, data/hora, motivo e transição |
| 15 | Conclusão bloqueada (Elisa) | CA-10 | Encerramento exige relatório final aprovado |
| 16 | Relatório final devolvido (Elisa) | CA-10 | Pendência no painel do aluno |
| 17 | Execução: horas e relatórios (Diego) | RF-08, RN-09 | Registro e validação de horas; relatórios |
| 18 | Deferimento parcial (Felipe) | CA-08, RN-13 | Horas reconhecidas e justificativa |
| 19 | Pesquisa com filtros | RF-09 | Filtro por status, curso, aluno |
| 20 | Auditoria | RF-10, RNF-06 | Trilha de ações |
| 21 | Resumo em PDF | RF-11 | PDF gerado com dados, pareceres e histórico |
| 22 | Tela de celular | CA-12, RNF-03 | Sem rolagem horizontal; tabelas em cartões |
| 23 | Testes automatizados | CA-01 a CA-12 | 26 testes aprovados |
| 24 | GitHub Actions | Qualidade | CI executado com sucesso |

CA-06 (Direção tentando concluir antes da análise) não tem botão na interface, porque a ação só aparece na etapa correta. A recusa do backend é comprovada pelo teste automatizado `CA-06` (print 23).

---

### 01 — Login
![01](evidencias/01-login.png)

### 02 — Painel da Secretaria
![02](evidencias/02-painel-secretaria.png)

### 03 — Fila com prazo expirado
![03](evidencias/03-fila-prazo-expirado.png)

### 04 — Prazo de correção vencido
![04](evidencias/04-prazo-correcao-joao.png)

### 05 — Início do estágio vencido
![05](evidencias/05-prazo-inicio-larissa.png)

### 06 — Matrícula irregular (CA-01)
![06](evidencias/06-matricula-irregular.png)

### 07 — Equiparação sem previsão no PPC (CA-07)
![07](evidencias/07-equiparacao-sem-ppc.png)

### 08 — Acesso a processo de outro aluno (CA-09)
![08](evidencias/08-acesso-negado.png)

### 09 — Nova solicitação
![09](evidencias/09-nova-solicitacao.png)

### 10 — TCE sem PAE (CA-02)
![10](evidencias/10-envio-bloqueado.png)

### 11 — Documento rejeitado e devolução (CA-03)
![11](evidencias/11-documento-rejeitado.png)

### 12 — Nova versão do documento (CA-04)
![12](evidencias/12-versoes-anteriores.png)

### 13 — PAE devolvido pelo professor (CA-05)
![13](evidencias/13-pae-devolvido-professor.png)

### 14 — Histórico (CA-11)
![14](evidencias/14-historico.png)

### 15 — Conclusão bloqueada (CA-10)
![15](evidencias/15-conclusao-bloqueada.png)

### 16 — Relatório final devolvido (CA-10)
![16](evidencias/16-relatorio-devolvido.png)

### 17 — Horas e relatórios
![17](evidencias/17-horas-relatorios.png)

### 18 — Deferimento parcial (CA-08)
![18](evidencias/18-deferimento-parcial.png)

### 19 — Pesquisa com filtros
![19](evidencias/19-pesquisa-filtros.png)

### 20 — Auditoria
![20](evidencias/20-auditoria.png)

### 21 — PDF
![21](evidencias/21-pdf.png)

### 22 — Celular (CA-12)
![22](evidencias/22-celular.png)

### 23 — Testes automatizados
![23](evidencias/23-testes-automaticos.png)

### 24 — GitHub Actions
![24](evidencias/24-github-actions.png)
