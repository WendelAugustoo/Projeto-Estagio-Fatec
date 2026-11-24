const { getDb } = require('../db');
const { notFound } = require('../utils/errors');

/**
 * Carrega a solicitação com todos os dados necessários para aplicar as regras
 * de negócio (aluno, curso, plano, documentos, pareceres, horas, relatórios).
 */
function carregarContexto(solicitacaoId) {
  const db = getDb();
  const sol = db
    .prepare(
      `SELECT s.*,
              a.usuario_id AS aluno_usuario_id, a.matricula, a.situacao_matricula, a.curso_id,
              u.nome AS aluno_nome, u.email AS aluno_email,
              c.nome AS curso_nome, c.carga_horaria_estagio, c.permite_equiparacao,
              co.razao_social AS concedente_nome, co.identificador AS concedente_identificador,
              co.situacao_convenio_declarada AS concedente_convenio,
              p.nome AS professor_nome
         FROM solicitacao s
         JOIN aluno a      ON a.id = s.aluno_id
         JOIN usuario u    ON u.id = a.usuario_id
         JOIN curso c      ON c.id = a.curso_id
    LEFT JOIN concedente co ON co.id = s.concedente_id
    LEFT JOIN usuario p   ON p.id = s.professor_id
        WHERE s.id = ?`
    )
    .get(solicitacaoId);
  if (!sol) throw notFound('Solicitação não encontrada.');

  const plano = db.prepare('SELECT * FROM plano_atividade WHERE solicitacao_id = ?').get(solicitacaoId) || {};
  const documentos = db
    .prepare(
      `SELECT d.*, u.nome AS enviado_por_nome, cf.nome AS conferido_por_nome
         FROM documento d
         JOIN usuario u ON u.id = d.enviado_por
    LEFT JOIN usuario cf ON cf.id = d.conferido_por
        WHERE d.solicitacao_id = ?
        ORDER BY d.tipo, d.versao DESC, d.id DESC`
    )
    .all(solicitacaoId);
  const pareceres = db
    .prepare(
      `SELECT pa.*, u.nome AS avaliador_nome, u.perfil AS avaliador_perfil
         FROM parecer pa JOIN usuario u ON u.id = pa.avaliador_id
        WHERE pa.solicitacao_id = ? ORDER BY pa.id`
    )
    .all(solicitacaoId);
  const horas = db
    .prepare(
      `SELECT h.*, u.nome AS validado_por_nome FROM registro_hora h
    LEFT JOIN usuario u ON u.id = h.validado_por
        WHERE h.solicitacao_id = ? ORDER BY h.data, h.id`
    )
    .all(solicitacaoId);
  const relatorios = db
    .prepare(
      `SELECT r.*, d.nome_arquivo, u.nome AS avaliado_por_nome FROM relatorio r
         JOIN documento d ON d.id = r.arquivo_id
    LEFT JOIN usuario u ON u.id = r.avaliado_por
        WHERE r.solicitacao_id = ? ORDER BY r.id`
    )
    .all(solicitacaoId);

  return { sol, plano, documentos, pareceres, horas, relatorios };
}

/** Versão vigente de cada tipo de documento (exclui as substituídas). */
function documentosVigentes(ctx) {
  return ctx.documentos.filter((d) => d.status !== 'SUBSTITUIDO');
}

/** Regra de visibilidade (CA-09). */
function podeVisualizar(user, sol) {
  switch (user.perfil) {
    case 'ALUNO':
      return sol.aluno_usuario_id === user.id;
    case 'PROFESSOR':
      return sol.professor_id === user.id;
    case 'SECRETARIA':
    case 'COORDENACAO':
    case 'ADMIN':
      return true;
    case 'DIRECAO':
      return true;
    default:
      return false;
  }
}

module.exports = { carregarContexto, documentosVigentes, podeVisualizar };
