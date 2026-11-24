const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const { autenticar, exigirPerfil } = require('../middlewares/auth');
const { receberArquivo } = require('../middlewares/upload');
const { UPLOAD_DIR } = require('../config');
const S = require('../services/solicitacoes');
const { executarAcao } = require('../services/workflow');
const { gerarPdf } = require('../services/pdf');
const { getDb } = require('../db');
const { notFound } = require('../utils/errors');

const router = express.Router();
router.use(autenticar);

router.get('/solicitacoes', (req, res) => res.json(S.listar(req.user, req.query)));
router.post('/solicitacoes', exigirPerfil('ALUNO'), (req, res) => res.status(201).json(S.criar(req.user, req.body)));
router.get('/solicitacoes/:id', (req, res) => res.json(S.detalhar(req.user, req.params.id)));
router.put('/solicitacoes/:id', exigirPerfil('ALUNO'), (req, res) => res.json(S.atualizar(req.user, req.params.id, req.body)));

// Documentos
router.post('/solicitacoes/:id/documentos', receberArquivo('arquivo'), (req, res) =>
  res.status(201).json(S.anexarDocumento(req.user, req.params.id, req.body.tipo, req.file))
);
router.get('/documentos/:id/download', (req, res, next) => {
  const doc = S.obterArquivo(req.user, req.params.id);
  const caminho = path.join(UPLOAD_DIR, path.basename(doc.caminho_seguro));
  if (!fs.existsSync(caminho)) return next(notFound('Arquivo não encontrado no armazenamento.'));
  res.setHeader('Content-Type', doc.mime_type);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(doc.nome_arquivo)}`);
  fs.createReadStream(caminho).pipe(res);
});
router.patch('/documentos/:id/conferencia', exigirPerfil('SECRETARIA'), (req, res) => res.json(S.conferirDocumento(req.user, req.params.id, req.body)));

// Dados de conferência (seguro e vias assinadas)
router.patch('/solicitacoes/:id/conferencia', exigirPerfil('SECRETARIA'), (req, res) => res.json(S.atualizarConferencia(req.user, req.params.id, req.body)));

// Workflow — rotas nomeadas conforme a especificação e rota genérica para as demais ações
router.post('/solicitacoes/:id/enviar', (req, res) => res.json(executarAcao(req.user, Number(req.params.id), 'enviar', req.body)));
router.post('/solicitacoes/:id/devolver', (req, res) => res.json(executarAcao(req.user, Number(req.params.id), 'devolver', req.body)));
router.post('/solicitacoes/:id/pareceres', (req, res) => {
  const acao = req.user.perfil === 'COORDENACAO' ? (req.body.acao === 'aprovar_plano' ? 'aprovar_plano' : 'decidir') : 'parecer_tecnico';
  res.status(201).json(executarAcao(req.user, Number(req.params.id), acao, req.body));
});
router.post('/solicitacoes/:id/acoes/:acao', (req, res) => res.json(executarAcao(req.user, Number(req.params.id), req.params.acao, req.body)));

// Horas
router.post('/solicitacoes/:id/horas', exigirPerfil('ALUNO'), (req, res) => res.status(201).json(S.registrarHoras(req.user, req.params.id, req.body)));
router.patch('/horas/:id/validacao', exigirPerfil('PROFESSOR'), (req, res) => res.json(S.validarHoras(req.user, req.params.id, req.body)));

// Relatórios
router.post('/solicitacoes/:id/relatorios', exigirPerfil('ALUNO'), receberArquivo('arquivo'), (req, res) =>
  res.status(201).json(S.enviarRelatorio(req.user, req.params.id, req.body, req.file))
);
router.patch('/relatorios/:id/avaliacao', exigirPerfil('PROFESSOR'), (req, res) => res.json(S.avaliarRelatorio(req.user, req.params.id, req.body)));

// Histórico e PDF
router.get('/solicitacoes/:id/historico', (req, res) => {
  const ctx = S.obterContextoVisivel(req.user, req.params.id);
  const historico = getDb()
    .prepare('SELECT h.*, u.nome AS autor_nome, u.perfil AS autor_perfil FROM historico_status h JOIN usuario u ON u.id = h.autor_id WHERE h.solicitacao_id = ? ORDER BY h.id')
    .all(ctx.sol.id);
  res.json(historico);
});
router.get('/solicitacoes/:id/pdf', (req, res) => {
  const ctx = S.obterContextoVisivel(req.user, req.params.id);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="solicitacao-${ctx.sol.protocolo || ctx.sol.id}.pdf"`);
  gerarPdf(ctx, req.user, res);
});

module.exports = router;
