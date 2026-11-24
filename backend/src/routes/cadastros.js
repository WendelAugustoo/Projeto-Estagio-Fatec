const express = require('express');
const { autenticar, exigirPerfil } = require('../middlewares/auth');
const K = require('../services/cadastros');
const C = require('../services/constants');
const S = require('../services/solicitacoes');
const { getDb } = require('../db');
const { carregarContexto } = require('../services/contexto');
const { pendencias } = require('../services/regras');

const router = express.Router();
router.use(autenticar);

// Domínios (rótulos) usados pela interface
router.get('/dominios', (req, res) =>
  res.json({
    modalidades: C.MODALIDADES,
    status: C.STATUS,
    status_finais: C.STATUS_FINAIS,
    tipos_documento: C.TIPOS_DOCUMENTO,
    documentos_por_modalidade: C.DOCUMENTOS_POR_MODALIDADE,
    documentos_obrigatorios: C.DOCUMENTOS_OBRIGATORIOS,
    tipos_atividade: C.TIPOS_ATIVIDADE_ACADEMICA,
    seguro: C.SEGURO,
    perfis: C.PERFIS,
  })
);

// Usuários — somente administrador técnico
router.get('/usuarios', exigirPerfil('ADMIN'), (req, res) => res.json(K.listarUsuarios()));
router.post('/usuarios', exigirPerfil('ADMIN'), (req, res) => res.status(201).json(K.criarUsuario(req.user, req.body)));
router.put('/usuarios/:id', exigirPerfil('ADMIN'), (req, res) => res.json(K.atualizarUsuario(req.user, req.params.id, req.body)));

// Alunos — Secretaria verifica cadastro/matrícula; administrador também gerencia
router.get('/alunos', exigirPerfil('SECRETARIA', 'ADMIN', 'COORDENACAO'), (req, res) => res.json(K.listarAlunos()));
router.put('/alunos/:id', exigirPerfil('SECRETARIA', 'ADMIN'), (req, res) => res.json(K.atualizarAluno(req.user, req.params.id, req.body)));

// Cursos
router.get('/cursos', (req, res) => res.json(K.listarCursos()));
router.post('/cursos', exigirPerfil('ADMIN', 'COORDENACAO'), (req, res) => res.status(201).json(K.salvarCurso(req.user, null, req.body)));
router.put('/cursos/:id', exigirPerfil('ADMIN', 'COORDENACAO'), (req, res) => res.json(K.salvarCurso(req.user, req.params.id, req.body)));

// Concedentes
router.get('/concedentes', (req, res) => res.json(K.listarConcedentes(req.user.perfil === 'ALUNO')));
router.post('/concedentes', exigirPerfil('SECRETARIA', 'ADMIN'), (req, res) => res.status(201).json(K.salvarConcedente(req.user, null, req.body)));
router.put('/concedentes/:id', exigirPerfil('SECRETARIA', 'ADMIN'), (req, res) => res.json(K.salvarConcedente(req.user, req.params.id, req.body)));

router.get('/professores', exigirPerfil('SECRETARIA', 'COORDENACAO', 'ADMIN'), (req, res) => res.json(K.listarProfessores()));

// Auditoria geral
router.get('/auditoria', exigirPerfil('ADMIN', 'COORDENACAO', 'DIRECAO'), (req, res) => res.json(K.listarAuditoria(req.query)));

// RF-12: dashboard operacional
router.get('/dashboard', (req, res) => {
  const lista = S.listar(req.user, { incluir_rascunhos: req.user.perfil === 'ALUNO' ? '1' : '0' });
  const porStatus = {};
  const porModalidade = {};
  for (const s of lista) {
    porStatus[s.status] = (porStatus[s.status] || 0) + 1;
    porModalidade[s.modalidade] = (porModalidade[s.modalidade] || 0) + 1;
  }
  const fila = lista.filter((s) => s.requer_minha_acao);
  const resposta = {
    total: lista.length,
    em_andamento: lista.filter((s) => !C.STATUS_FINAIS.includes(s.status)).length,
    concluidas: lista.filter((s) => C.STATUS_FINAIS.includes(s.status)).length,
    por_status: porStatus,
    por_modalidade: porModalidade,
    fila: fila.slice(0, 10),
    fila_total: fila.length,
    recentes: lista.slice(0, 5),
  };
  if (req.user.perfil === 'ALUNO') {
    resposta.pendencias = lista
      .map((s) => ({ id: s.id, protocolo: s.protocolo, modalidade: s.modalidade, status: s.status, itens: pendencias(carregarContexto(s.id)) }))
      .filter((p) => p.itens.length);
  }
  if (['SECRETARIA', 'COORDENACAO', 'DIRECAO', 'ADMIN'].includes(req.user.perfil)) {
    resposta.alunos_irregulares = getDb().prepare("SELECT COUNT(*) AS n FROM aluno WHERE situacao_matricula = 'IRREGULAR'").get().n;
  }
  res.json(resposta);
});

module.exports = router;
