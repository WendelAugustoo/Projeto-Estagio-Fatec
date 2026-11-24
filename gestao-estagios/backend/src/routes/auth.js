const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config');
const { autenticar } = require('../middlewares/auth');
const { audit } = require('../utils/audit');
const { unauthorized, badRequest } = require('../utils/errors');

const router = express.Router();

// Limite simples de tentativas por IP + e-mail (proteção básica contra força bruta).
const tentativas = new Map();
const JANELA_MS = 15 * 60 * 1000;
const MAX_TENTATIVAS = 10;

router.post('/login', (req, res, next) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const senha = String(req.body?.senha || '');
  if (!email || !senha) return next(badRequest('Informe e-mail e senha.'));

  const chave = `${req.ip}|${email}`;
  const reg = tentativas.get(chave);
  if (reg && reg.count >= MAX_TENTATIVAS && Date.now() - reg.inicio < JANELA_MS) {
    return res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Muitas tentativas. Aguarde alguns minutos.' } });
  }

  const user = getDb().prepare('SELECT * FROM usuario WHERE email = ?').get(email);
  const ok = user && user.ativo && bcrypt.compareSync(senha, user.senha_hash);
  if (!ok) {
    const atual = reg && Date.now() - reg.inicio < JANELA_MS ? reg : { count: 0, inicio: Date.now() };
    tentativas.set(chave, { ...atual, count: atual.count + 1 });
    audit(user?.id ?? null, 'LOGIN_FALHA', 'usuario', user?.id ?? null, null);
    // Mensagem genérica: não revela se o e-mail existe.
    return next(unauthorized('E-mail ou senha inválidos.'));
  }
  tentativas.delete(chave);
  audit(user.id, 'LOGIN_SUCESSO', 'usuario', user.id, null);
  const token = jwt.sign({ sub: user.id, perfil: user.perfil }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  res.json({ token, usuario: { id: user.id, nome: user.nome, email: user.email, perfil: user.perfil } });
});

router.get('/me', autenticar, (req, res) => {
  const aluno = getDb()
    .prepare('SELECT a.id, a.matricula, a.situacao_matricula, a.curso_id, c.nome AS curso_nome, c.permite_equiparacao FROM aluno a JOIN curso c ON c.id = a.curso_id WHERE a.usuario_id = ?')
    .get(req.user.id);
  res.json({ ...req.user, aluno: aluno || null });
});

module.exports = router;
