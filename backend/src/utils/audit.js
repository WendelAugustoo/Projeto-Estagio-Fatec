const { getDb } = require('../db');

/** Registra uma ação na trilha de auditoria geral (RF-10 / RNF-06). */
function audit(usuarioId, acao, entidade, entidadeId, detalhes) {
  getDb()
    .prepare('INSERT INTO auditoria (usuario_id, acao, entidade, entidade_id, detalhes) VALUES (?, ?, ?, ?, ?)')
    .run(usuarioId ?? null, acao, entidade, entidadeId ?? null, detalhes ? JSON.stringify(detalhes) : null);
}

const now = () => new Date().toISOString();

module.exports = { audit, now };
