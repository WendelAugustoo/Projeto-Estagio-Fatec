# Modelo de dados

Banco relacional SQLite com chaves estrangeiras ativadas (`PRAGMA foreign_keys = ON`). Script completo: [`backend/src/db/schema.sql`](../backend/src/db/schema.sql). Datas e horas em ISO 8601 UTC; a interface exibe no fuso America/Sao_Paulo.

## DER

```mermaid
erDiagram
    USUARIO ||--o| ALUNO : "é (perfil ALUNO)"
    CURSO ||--o{ ALUNO : matricula
    ALUNO ||--o{ SOLICITACAO : abre
    CONCEDENTE |o--o{ SOLICITACAO : "concede (regular)"
    USUARIO |o--o{ SOLICITACAO : "professor responsável"
    SOLICITACAO ||--|| PLANO_ATIVIDADE : possui
    SOLICITACAO ||--o{ DOCUMENTO : anexa
    SOLICITACAO ||--o{ PARECER : recebe
    SOLICITACAO ||--o{ REGISTRO_HORA : registra
    SOLICITACAO ||--o{ RELATORIO : entrega
    DOCUMENTO ||--o| RELATORIO : "arquivo de"
    SOLICITACAO ||--o{ HISTORICO_STATUS : "transições"
    USUARIO ||--o{ HISTORICO_STATUS : autor
    USUARIO ||--o{ PARECER : avaliador
    USUARIO ||--o{ DOCUMENTO : "enviado/conferido por"
    USUARIO ||--o{ AUDITORIA : ator

    USUARIO {
        int id PK
        text nome
        text email UK
        text senha_hash
        text perfil
        int ativo
    }
    ALUNO {
        int id PK
        int usuario_id FK
        text matricula UK
        int curso_id FK
        text situacao_matricula
    }
    CURSO {
        int id PK
        text nome UK
        int carga_horaria_estagio
        int permite_equiparacao
    }
    CONCEDENTE {
        int id PK
        text razao_social
        text identificador UK
        text contato
        text situacao_convenio_declarada
    }
    SOLICITACAO {
        int id PK
        text protocolo UK
        int aluno_id FK
        text modalidade
        text status
        text retorno_status
        text prazo_correcao
        int concedente_id FK
        int professor_id FK
        text seguro_situacao
        int ass_aluno
        int ass_concedente
        int ass_coordenacao
        int ass_direcao
        int horas_reconhecidas
    }
    PLANO_ATIVIDADE {
        int id PK
        int solicitacao_id FK
        text descricao
        text tecnicas
        text compatibilidade
        text periodo_inicio
        text periodo_fim
        int horas_previstas
    }
    DOCUMENTO {
        int id PK
        int solicitacao_id FK
        text tipo
        int versao
        text nome_arquivo
        text caminho_seguro
        text status
        int enviado_por FK
        int conferido_por FK
    }
    PARECER {
        int id PK
        int solicitacao_id FK
        int avaliador_id FK
        text tipo
        text resultado
        int horas_sugeridas
        text justificativa
    }
    REGISTRO_HORA {
        int id PK
        int solicitacao_id FK
        text data
        real horas
        text descricao
        text validado
    }
    RELATORIO {
        int id PK
        int solicitacao_id FK
        text tipo
        text periodo
        int arquivo_id FK
        text estado_avaliacao
    }
    HISTORICO_STATUS {
        int id PK
        int solicitacao_id FK
        text status_anterior
        text status_novo
        text acao
        int autor_id FK
        text motivo
        text data_hora
    }
    AUDITORIA {
        int id PK
        int usuario_id FK
        text acao
        text entidade
        int entidade_id
        text detalhes
        text data_hora
    }
```

## Dicionário de tabelas

| Tabela | Finalidade | Observações |
|---|---|---|
| `usuario` | Contas de acesso e perfil | `perfil` ∈ ALUNO, SECRETARIA, PROFESSOR, COORDENACAO, DIRECAO, ADMIN; senha com bcrypt |
| `aluno` | Dados acadêmicos do aluno | `situacao_matricula` REGULAR/IRREGULAR (RN-01) |
| `curso` | Cursos | `permite_equiparacao` representa a previsão no PPC (RN-12) |
| `concedente` | Empresas concedentes | Situação de convênio apenas declarada (validação humana) |
| `solicitacao` | Processo de estágio/equivalência/equiparação | `status` segue a máquina de estados; `retorno_status` indica a etapa que recebe o reenvio; `prazo_correcao` guarda a data-limite da correção (prazo expirado); campos de seguro e assinaturas só são alterados pela Secretaria/Coordenação/Direção |
| `plano_atividade` | PAE ou descrição das atividades | 1:1 com a solicitação (RN-05, RN-11) |
| `documento` | Metadados dos anexos | Arquivo em diretório privado com nome aleatório (`caminho_seguro`); nova versão marca a anterior como SUBSTITUIDO (CA-04) |
| `parecer` | Pareceres técnico, acadêmico e de avaliação final | Justificativa obrigatória (RN-13) |
| `registro_hora` | Horas executadas | Validação pelo professor responsável |
| `relatorio` | Relatórios parcial/final | Referencia o documento; estados PENDENTE, APROVADO, DEVOLVIDO, SUBSTITUIDO |
| `historico_status` | Toda transição de estado | Ator, data/hora, motivo, estado anterior e novo (RNF-06, CA-11) |
| `auditoria` | Trilha geral | Logins, uploads, downloads, conferências, pareceres, cadastros, transições recusadas — com antes/depois em JSON |

Integridade: chaves estrangeiras, `CHECK` nos domínios, `UNIQUE` em e-mail, matrícula, protocolo e identificador da concedente; alterações críticas (transições, uploads com versionamento, relatórios) em transação (`BEGIN IMMEDIATE … COMMIT`).
