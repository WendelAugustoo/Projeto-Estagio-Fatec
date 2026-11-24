/** RF-02: cadastros de usuários, alunos, cursos e concedentes. */
const bcrypt = require('bcryptjs');
const { getDb, transaction } = require('../db');
const { audit } = require('../utils/audit');
const { badRequest, notFound, conflict, forbidden } = require('../utils/errors');
const { PERFIS } = require('./constants');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const txt = (v) => (v === undefined || v === null ? '' : String(v).trim());

function tratarUnico(err, msg) {
  if (String(err.message).includes('UNIQUE')) throw conflict(msg);
  throw err;
}

/* ------------------------------------------------------------ usuários (admin) */

function listarUsuarios() {
  return getDb()
    .prepare(
      `SELECT u.id, u.nome, u.email, u.perfil, u.ativo, u.criado_em, a.matricula, a.situacao_matricula, a.curso_id, c.nome AS curso_nome
         FROM usuario u LEFT JOIN aluno a ON a.usuario_id = u.id LEFT JOIN curso c ON c.id = a.curso_id
        ORDER BY u.perfil, u.nome`
    )
    .all();
}

function validarSenha(senha) {
  if (txt(senha).length < 8) throw badRequest('A senha deve ter pelo menos 8 caracteres.');
}

function criarUsuario(ator, body) {
  const nome = txt(body.nome);
  const email = txt(body.email).toLowerCase();
  if (!nome) throw badRequest('Informe o nome.');
  if (!EMAIL_RE.test(email)) throw badRequest('E-mail inválido.');
  if (!PERFIS.includes(body.perfil)) throw badRequest('Perfil inválido.');
  validarSenha(body.senha);
  if (body.perfil === 'ALUNO' && (!txt(body.matricula) || !body.curso_id)) throw badRequest('Para alunos, informe matrícula e curso.');

  return transaction((conn) => {
    try {
      const { lastInsertRowid } = conn
        .prepare('INSERT INTO usuario (nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?)')
        .run(nome, email, bcrypt.hashSync(body.senha, 10), body.perfil);
      const id = Number(lastInsertRowid);
      if (body.perfil === 'ALUNO') {
        if (!conn.prepare('SELECT id FROM curso WHERE id = ?').get(Number(body.curso_id))) throw badRequest('Curso inválido.');
        conn
          .prepare('INSERT INTO aluno (usuario_id, matricula, curso_id, situacao_matricula) VALUES (?, ?, ?, ?)')
          .run(id, txt(body.matricula), Number(body.curso_id), body.situacao_matricula === 'IRREGULAR' ? 'IRREGULAR' : 'REGULAR');
      }
      audit(ator.id, 'USUARIO_CRIADO', 'usuario', id, { email, perfil: body.perfil });
      return { id };
    } catch (err) {
      tratarUnico(err, 'E-mail ou matrícula já cadastrados.');
    }
  });
}

function atualizarUsuario(ator, id, body) {
  const db = getDb();
  const atual = db.prepare('SELECT * FROM usuario WHERE id = ?').get(Number(id));
  if (!atual) throw notFound('Usuário não encontrado.');
  const nome = body.nome !== undefined ? txt(body.nome) : atual.nome;
  if (!nome) throw badRequest('Informe o nome.');
  const ativo = body.ativo !== undefined ? (body.ativo ? 1 : 0) : atual.ativo;
  if (atual.id === ator.id && !ativo) throw badRequest('Você não pode desativar a própria conta.');
  // O perfil não muda após a criação para preservar a coerência do histórico.
  db.prepare('UPDATE usuario SET nome = ?, ativo = ? WHERE id = ?').run(nome, ativo, atual.id);
  if (body.senha) {
    validarSenha(body.senha);
    db.prepare('UPDATE usuario SET senha_hash = ? WHERE id = ?').run(bcrypt.hashSync(body.senha, 10), atual.id);
  }
  audit(ator.id, 'USUARIO_ATUALIZADO', 'usuario', atual.id, { antes: { nome: atual.nome, ativo: atual.ativo }, depois: { nome, ativo }, senha_alterada: Boolean(body.senha) });
  return { id: atual.id };
}

/* ------------------------------------------------------------ alunos (secretaria/admin) */

function listarAlunos() {
  return getDb()
    .prepare(
      `SELECT a.id, a.matricula, a.situacao_matricula, a.curso_id, c.nome AS curso_nome, u.id AS usuario_id, u.nome, u.email, u.ativo
         FROM aluno a JOIN usuario u ON u.id = a.usuario_id JOIN curso c ON c.id = a.curso_id ORDER BY u.nome`
    )
    .all();
}

function atualizarAluno(ator, id, body) {
  const db = getDb();
  const atual = db.prepare('SELECT * FROM aluno WHERE id = ?').get(Number(id));
  if (!atual) throw notFound('Aluno não encontrado.');
  const situacao = body.situacao_matricula ?? atual.situacao_matricula;
  if (!['REGULAR', 'IRREGULAR'].includes(situacao)) throw badRequest('Situação de matrícula inválida.');
  const cursoId = body.curso_id ? Number(body.curso_id) : atual.curso_id;
  if (!db.prepare('SELECT id FROM curso WHERE id = ?').get(cursoId)) throw badRequest('Curso inválido.');
  const matricula = body.matricula !== undefined ? txt(body.matricula) : atual.matricula;
  if (!matricula) throw badRequest('Informe a matrícula.');
  try {
    db.prepare('UPDATE aluno SET situacao_matricula = ?, curso_id = ?, matricula = ? WHERE id = ?').run(situacao, cursoId, matricula, atual.id);
  } catch (err) {
    tratarUnico(err, 'Matrícula já cadastrada.');
  }
  audit(ator.id, 'ALUNO_ATUALIZADO', 'aluno', atual.id, {
    antes: { situacao_matricula: atual.situacao_matricula, curso_id: atual.curso_id, matricula: atual.matricula },
    depois: { situacao_matricula: situacao, curso_id: cursoId, matricula },
  });
  return { id: atual.id };
}

/* ------------------------------------------------------------ cursos */

function listarCursos() {
  return getDb().prepare('SELECT * FROM curso ORDER BY nome').all();
}

function salvarCurso(ator, id, body) {
  const nome = txt(body.nome);
  const carga = Number(body.carga_horaria_estagio);
  if (!nome) throw badRequest('Informe o nome do curso.');
  if (!Number.isInteger(carga) || carga < 0) throw badRequest('Carga horária de estágio inválida.');
  const permite = body.permite_equiparacao ? 1 : 0;
  const ativo = body.ativo === undefined ? 1 : body.ativo ? 1 : 0;
  const db = getDb();
  try {
    if (id) {
      const atual = db.prepare('SELECT * FROM curso WHERE id = ?').get(Number(id));
      if (!atual) throw notFound('Curso não encontrado.');
      db.prepare('UPDATE curso SET nome = ?, carga_horaria_estagio = ?, permite_equiparacao = ?, ativo = ? WHERE id = ?').run(nome, carga, permite, ativo, atual.id);
      audit(ator.id, 'CURSO_ATUALIZADO', 'curso', atual.id, { antes: atual, depois: { nome, carga, permite, ativo } });
      return { id: atual.id };
    }
    const { lastInsertRowid } = db.prepare('INSERT INTO curso (nome, carga_horaria_estagio, permite_equiparacao, ativo) VALUES (?, ?, ?, ?)').run(nome, carga, permite, ativo);
    audit(ator.id, 'CURSO_CRIADO', 'curso', Number(lastInsertRowid), { nome });
    return { id: Number(lastInsertRowid) };
  } catch (err) {
    tratarUnico(err, 'Já existe um curso com este nome.');
  }
}

/* ------------------------------------------------------------ concedentes */

function listarConcedentes(apenasAtivas) {
  return getDb()
    .prepare(`SELECT * FROM concedente ${apenasAtivas ? 'WHERE ativo = 1' : ''} ORDER BY razao_social`)
    .all();
}

function salvarConcedente(ator, id, body) {
  const razao = txt(body.razao_social);
  const ident = txt(body.identificador);
  if (!razao) throw badRequest('Informe a razão social.');
  if (!ident) throw badRequest('Informe o identificador (CNPJ fictício ou código interno).');
  const situacao = body.situacao_convenio_declarada || 'NAO_VERIFICADO';
  if (!['DECLARADO_VIGENTE', 'NAO_VERIFICADO', 'SEM_CONVENIO'].includes(situacao)) throw badRequest('Situação de convênio inválida.');
  const contato = txt(body.contato) || null;
  const ativo = body.ativo === undefined ? 1 : body.ativo ? 1 : 0;
  const db = getDb();
  try {
    if (id) {
      const atual = db.prepare('SELECT * FROM concedente WHERE id = ?').get(Number(id));
      if (!atual) throw notFound('Concedente não encontrada.');
      db.prepare('UPDATE concedente SET razao_social = ?, identificador = ?, contato = ?, situacao_convenio_declarada = ?, ativo = ? WHERE id = ?').run(razao, ident, contato, situacao, ativo, atual.id);
      audit(ator.id, 'CONCEDENTE_ATUALIZADA', 'concedente', atual.id, { antes: atual, depois: { razao, ident, contato, situacao, ativo } });
      return { id: atual.id };
    }
    const { lastInsertRowid } = db
      .prepare('INSERT INTO concedente (razao_social, identificador, contato, situacao_convenio_declarada, ativo) VALUES (?, ?, ?, ?, ?)')
      .run(razao, ident, contato, situacao, ativo);
    audit(ator.id, 'CONCEDENTE_CRIADA', 'concedente', Number(lastInsertRowid), { razao, ident });
    return { id: Number(lastInsertRowid) };
  } catch (err) {
    tratarUnico(err, 'Identificador de concedente já cadastrado.');
  }
}

function listarProfessores() {
  return getDb().prepare("SELECT id, nome, email FROM usuario WHERE perfil = 'PROFESSOR' AND ativo = 1 ORDER BY nome").all();
}

/* ------------------------------------------------------------ auditoria */

function listarAuditoria(filtros = {}) {
  const where = [];
  const params = [];
  if (filtros.entidade) {
    where.push('a.entidade = ?');
    params.push(filtros.entidade);
  }
  if (filtros.entidade_id) {
    where.push('a.entidade_id = ?');
    params.push(Number(filtros.entidade_id));
  }
  if (filtros.acao) {
    where.push('a.acao = ?');
    params.push(filtros.acao);
  }
  if (filtros.usuario) {
    where.push('u.nome LIKE ?');
    params.push(`%${filtros.usuario}%`);
  }
  const limite = Math.min(Number(filtros.limite) || 200, 1000);
  return getDb()
    .prepare(
      `SELECT a.*, u.nome AS usuario_nome, u.perfil AS usuario_perfil FROM auditoria a LEFT JOIN usuario u ON u.id = a.usuario_id
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY a.id DESC LIMIT ${limite}`
    )
    .all(...params)
    .map((r) => ({ ...r, detalhes: r.detalhes ? JSON.parse(r.detalhes) : null }));
}

module.exports = {
  listarUsuarios,
  criarUsuario,
  atualizarUsuario,
  listarAlunos,
  atualizarAluno,
  listarCursos,
  salvarCurso,
  listarConcedentes,
  salvarConcedente,
  listarProfessores,
  listarAuditoria,
  forbidden,
};
