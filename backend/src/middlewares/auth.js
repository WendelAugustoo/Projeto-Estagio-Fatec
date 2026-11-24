const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
const { getDb } = require('../db');
const { unauthorized, forbidden } = require('../utils/errors');

/** Valida o token JWT e recarrega o usuário (garante que contas desativadas percam acesso). */
function autenticar(req, res, next) {
  const header = req.headers.authorization || '';
  const [tipo, token] = header.split(' ');
  if (tipo !== 'Bearer' || !token) return next(unauthorized());
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = getDb().prepare('SELECT id, nome, email, perfil, ativo FROM usuario WHERE id = ?').get(payload.sub);
    if (!user || !user.ativo) return next(unauthorized('Usuário inativo ou inexistente.'));
    req.user = user;
    next();
  } catch {
    next(unauthorized());
  }
}

/** Restringe a rota aos perfis informados (RF-01). */
const exigirPerfil =
  (...perfis) =>
  (req, res, next) =>
    perfis.includes(req.user.perfil) ? next() : next(forbidden());

module.exports = { autenticar, exigirPerfil };
