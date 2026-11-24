const express = require('express');
const cors = require('cors');
const fs = require('node:fs');
const { CORS_ORIGIN } = require('./config');
const { AppError } = require('./utils/errors');

function criarApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: CORS_ORIGIN.split(',') }));
  app.use(express.json({ limit: '200kb' }));
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api', require('./routes/solicitacoes'));
  app.use('/api', require('./routes/cadastros'));

  app.use('/api', (req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Rota não encontrada.' } }));

  // Tratamento centralizado de erros: mensagens claras sem expor detalhes internos.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (req.file?.path) fs.rmSync(req.file.path, { force: true });
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    }
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'JSON inválido.' } });
    }
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erro interno. Tente novamente.' } });
  });
  return app;
}

module.exports = { criarApp };
