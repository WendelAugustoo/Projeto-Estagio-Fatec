-- Sistema de Gestão de Estágios Supervisionados — script de criação (SQLite)
-- Datas armazenadas em ISO 8601 UTC (texto). Exibição em America/Sao_Paulo no frontend.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS usuario (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nome          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  senha_hash    TEXT    NOT NULL,
  perfil        TEXT    NOT NULL CHECK (perfil IN ('ALUNO','SECRETARIA','PROFESSOR','COORDENACAO','DIRECAO','ADMIN')),
  ativo         INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0,1)),
  criado_em     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS curso (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  nome                   TEXT    NOT NULL UNIQUE,
  carga_horaria_estagio  INTEGER NOT NULL CHECK (carga_horaria_estagio >= 0),
  permite_equiparacao    INTEGER NOT NULL DEFAULT 0 CHECK (permite_equiparacao IN (0,1)),
  ativo                  INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0,1))
);

CREATE TABLE IF NOT EXISTS aluno (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id          INTEGER NOT NULL UNIQUE REFERENCES usuario(id),
  matricula           TEXT    NOT NULL UNIQUE,
  curso_id            INTEGER NOT NULL REFERENCES curso(id),
  situacao_matricula  TEXT    NOT NULL DEFAULT 'REGULAR' CHECK (situacao_matricula IN ('REGULAR','IRREGULAR'))
);

CREATE TABLE IF NOT EXISTS concedente (
  id                          INTEGER PRIMARY KEY AUTOINCREMENT,
  razao_social                TEXT NOT NULL,
  identificador               TEXT NOT NULL UNIQUE, -- CNPJ fictício ou código interno
  contato                     TEXT,
  situacao_convenio_declarada TEXT NOT NULL DEFAULT 'NAO_VERIFICADO'
                              CHECK (situacao_convenio_declarada IN ('DECLARADO_VIGENTE','NAO_VERIFICADO','SEM_CONVENIO')),
  ativo                       INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0,1))
);

CREATE TABLE IF NOT EXISTS solicitacao (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  protocolo              TEXT UNIQUE,                    -- gerado no primeiro envio
  aluno_id               INTEGER NOT NULL REFERENCES aluno(id),
  modalidade             TEXT    NOT NULL CHECK (modalidade IN ('REGULAR','EQUIVALENCIA','EQUIPARACAO')),
  status                 TEXT    NOT NULL DEFAULT 'RASCUNHO',
  retorno_status         TEXT,                           -- etapa que deve receber o reenvio após correção
  prazo_correcao         TEXT,                           -- AAAA-MM-DD: data-limite para o aluno corrigir (definida na devolução)
  concedente_id          INTEGER REFERENCES concedente(id),
  professor_id           INTEGER REFERENCES usuario(id), -- professor responsável (definido pela Secretaria)
  tipo_atividade         TEXT,                           -- equiparação: IC, monitoria, pesquisa, extensão
  orientador_nome        TEXT,                           -- equiparação
  empresa_vinculo        TEXT,                           -- equivalência: empresa / empregador
  -- RN-08: seguro registrado somente pela Secretaria
  seguro_situacao        TEXT NOT NULL DEFAULT 'NAO_INFORMADO'
                         CHECK (seguro_situacao IN ('NAO_INFORMADO','CONTRATADO_CONCEDENTE','CONTRATADO_INSTITUICAO','NAO_APLICAVEL')),
  seguro_apolice         TEXT,
  seguro_responsavel     TEXT,
  -- RN-03 / RN-07: controle (simulado) de vias e assinaturas do TCE
  ass_aluno              INTEGER NOT NULL DEFAULT 0 CHECK (ass_aluno IN (0,1)),
  ass_concedente         INTEGER NOT NULL DEFAULT 0 CHECK (ass_concedente IN (0,1)),
  ass_coordenacao        INTEGER NOT NULL DEFAULT 0 CHECK (ass_coordenacao IN (0,1)),
  ass_direcao            INTEGER NOT NULL DEFAULT 0 CHECK (ass_direcao IN (0,1)),
  horas_reconhecidas     INTEGER,
  criada_em              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  enviada_em             TEXT,
  atualizada_em          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  encerrada_em           TEXT
);
CREATE INDEX IF NOT EXISTS ix_solicitacao_aluno  ON solicitacao(aluno_id);
CREATE INDEX IF NOT EXISTS ix_solicitacao_status ON solicitacao(status);

CREATE TABLE IF NOT EXISTS plano_atividade (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  solicitacao_id   INTEGER NOT NULL UNIQUE REFERENCES solicitacao(id) ON DELETE CASCADE,
  descricao        TEXT,
  tecnicas         TEXT,
  compatibilidade  TEXT,   -- RN-05: justificativa de compatibilidade com o curso
  periodo_inicio   TEXT,   -- AAAA-MM-DD
  periodo_fim      TEXT,
  horas_previstas  INTEGER
);

CREATE TABLE IF NOT EXISTS documento (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  solicitacao_id   INTEGER NOT NULL REFERENCES solicitacao(id),
  tipo             TEXT    NOT NULL,
  versao           INTEGER NOT NULL DEFAULT 1,
  nome_arquivo     TEXT    NOT NULL,   -- nome original (exibição apenas)
  caminho_seguro   TEXT    NOT NULL,   -- nome aleatório dentro do diretório privado
  mime_type        TEXT    NOT NULL,
  tamanho_bytes    INTEGER NOT NULL,
  enviado_por      INTEGER NOT NULL REFERENCES usuario(id),
  data_envio       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  status           TEXT    NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE','CONFERIDO','REJEITADO','SUBSTITUIDO')),
  observacao       TEXT,
  conferido_por    INTEGER REFERENCES usuario(id),
  conferido_em     TEXT
);
CREATE INDEX IF NOT EXISTS ix_documento_solicitacao ON documento(solicitacao_id, tipo);

CREATE TABLE IF NOT EXISTS parecer (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  solicitacao_id   INTEGER NOT NULL REFERENCES solicitacao(id),
  avaliador_id     INTEGER NOT NULL REFERENCES usuario(id),
  tipo             TEXT    NOT NULL CHECK (tipo IN ('TECNICO','ACADEMICO','FINAL')),
  resultado        TEXT    NOT NULL,
  horas_sugeridas  INTEGER,
  justificativa    TEXT    NOT NULL,
  data             TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS registro_hora (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  solicitacao_id   INTEGER NOT NULL REFERENCES solicitacao(id),
  data             TEXT    NOT NULL,   -- AAAA-MM-DD
  horas            REAL    NOT NULL CHECK (horas > 0 AND horas <= 12),
  descricao        TEXT    NOT NULL,
  validado         TEXT    NOT NULL DEFAULT 'PENDENTE' CHECK (validado IN ('PENDENTE','VALIDADO','RECUSADO')),
  validado_por     INTEGER REFERENCES usuario(id),
  observacao       TEXT,
  criado_em        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS relatorio (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  solicitacao_id    INTEGER NOT NULL REFERENCES solicitacao(id),
  tipo              TEXT    NOT NULL CHECK (tipo IN ('PARCIAL','FINAL')),
  periodo           TEXT    NOT NULL,
  arquivo_id        INTEGER NOT NULL REFERENCES documento(id),
  estado_avaliacao  TEXT    NOT NULL DEFAULT 'PENDENTE' CHECK (estado_avaliacao IN ('PENDENTE','APROVADO','DEVOLVIDO','SUBSTITUIDO')),
  avaliado_por      INTEGER REFERENCES usuario(id),
  observacao        TEXT,
  enviado_em        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  avaliado_em       TEXT
);

CREATE TABLE IF NOT EXISTS historico_status (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  solicitacao_id   INTEGER NOT NULL REFERENCES solicitacao(id),
  status_anterior  TEXT,
  status_novo      TEXT    NOT NULL,
  acao             TEXT    NOT NULL,
  autor_id         INTEGER NOT NULL REFERENCES usuario(id),
  motivo           TEXT,
  data_hora        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS ix_historico_solicitacao ON historico_status(solicitacao_id);

-- Trilha de auditoria geral (uploads, pareceres, cadastros, logins, transições)
CREATE TABLE IF NOT EXISTS auditoria (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id  INTEGER REFERENCES usuario(id),
  acao        TEXT NOT NULL,
  entidade    TEXT NOT NULL,
  entidade_id INTEGER,
  detalhes    TEXT,   -- JSON
  data_hora   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS ix_auditoria_entidade ON auditoria(entidade, entidade_id);
