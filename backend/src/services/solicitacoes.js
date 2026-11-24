/**
 * Operações sobre solicitações que não são transições de estado:
 * criação/edição, documentos, conferência, horas e relatórios.
 */
const fs = require('node:fs');
const { getDb, transaction } = require('../db');
const { audit, now } = require('../utils/audit');
const { badRequest, forbidden, notFound, businessRule } = require('../utils/errors');
const C = require('./constants');
const { carregarContexto, podeVisualizar } = require('./contexto');
const { acoesDisponiveis, registrarTransicao } = require('./workflow');
const R = require('./regras');

const texto = (v, max = 4000) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (s.length > max) throw badRequest(`Campo excede ${max} caracteres.`);
  return s || null;
};
const data = (v, campo) => {
  if (v === undefined || v === null || v === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) throw badRequest(`Data inválida em ${campo} (use AAAA-MM-DD).`);
  return v;
};
const inteiro = (v, campo) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 10000) throw badRequest(`Valor inválido em ${campo}.`);
  return n;
};

function obterContextoVisivel(user, id) {
  const ctx = carregarContexto(Number(id));
  if (!podeVisualizar(user, ctx.sol)) throw notFound('Solicitação não encontrada.'); // CA-09: não revela existência
  return ctx;
}

function alunoDoUsuario(userId) {
  const aluno = getDb().prepare('SELECT * FROM aluno WHERE usuario_id = ?').get(userId);
  if (!aluno) throw forbidden('Seu usuário não possui cadastro de aluno.');
  return aluno;
}

/* ------------------------------------------------------------------ listagem */

function listar(user, filtros = {}) {
  const where = [];
  const params = [];
  if (user.perfil === 'ALUNO') {
    where.push('a.usuario_id = ?');
    params.push(user.id);
  } else if (user.perfil === 'PROFESSOR') {
    where.push('s.professor_id = ?');
    params.push(user.id);
  }
  if (filtros.status) {
    where.push('s.status = ?');
    params.push(filtros.status);
  }
  if (filtros.modalidade) {
    where.push('s.modalidade = ?');
    params.push(filtros.modalidade);
  }
  if (filtros.curso_id) {
    where.push('a.curso_id = ?');
    params.push(Number(filtros.curso_id));
  }
  if (filtros.aluno) {
    where.push('(u.nome LIKE ? OR a.matricula LIKE ? OR s.protocolo LIKE ?)');
    const like = `%${filtros.aluno}%`;
    params.push(like, like, like);
  }
  if (user.perfil !== 'ALUNO' && filtros.incluir_rascunhos !== '1') where.push("s.status <> 'RASCUNHO'");

  const linhas = getDb()
    .prepare(
      `SELECT s.id, s.protocolo, s.modalidade, s.status, s.criada_em, s.enviada_em, s.atualizada_em,
              u.nome AS aluno_nome, a.matricula, c.nome AS curso_nome, co.razao_social AS concedente_nome,
              p.nome AS professor_nome
         FROM solicitacao s
         JOIN aluno a ON a.id = s.aluno_id
         JOIN usuario u ON u.id = a.usuario_id
         JOIN curso c ON c.id = a.curso_id
    LEFT JOIN concedente co ON co.id = s.concedente_id
    LEFT JOIN usuario p ON p.id = s.professor_id
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY s.atualizada_em DESC`
    )
    .all(...params);

  return linhas
    .map((l) => {
      const ctx = carregarContexto(l.id);
      const acoes = acoesDisponiveis(user, ctx).filter(
        (a) => !a.secundaria && a.bloqueios.length === 0 && !(a.acao === 'parecer_tecnico' && parecerTecnicoJaEmitido(ctx))
      );
      return { ...l, requer_minha_acao: acoes.length > 0 || tarefasOperacionais(user, ctx) > 0 };
    })
    .filter((l) => filtros.fila !== '1' || l.requer_minha_acao);
}

/** O professor já emitiu parecer técnico desde a última entrada em análise acadêmica? */
function parecerTecnicoJaEmitido(ctx) {
  const entrada = getDb()
    .prepare("SELECT MAX(data_hora) AS d FROM historico_status WHERE solicitacao_id = ? AND status_novo = 'EM_ANALISE_ACADEMICA'")
    .get(ctx.sol.id).d;
  return ctx.pareceres.some((p) => p.tipo === 'TECNICO' && (!entrada || p.data >= entrada));
}

/** Tarefas que não são transições: validar horas, avaliar relatórios, conferir documentos. */
function tarefasOperacionais(user, ctx) {
  const { sol } = ctx;
  if (user.perfil === 'PROFESSOR' && sol.professor_id === user.id && ['EM_EXECUCAO', 'EM_AVALIACAO_FINAL'].includes(sol.status)) {
    return ctx.horas.filter((h) => h.validado === 'PENDENTE').length + ctx.relatorios.filter((r) => r.estado_avaliacao === 'PENDENTE').length;
  }
  if (user.perfil === 'SECRETARIA' && sol.status === 'EM_CONFERENCIA') {
    return ctx.documentos.filter((d) => d.status === 'PENDENTE').length;
  }
  if (user.perfil === 'SECRETARIA' && sol.status === 'AGUARDANDO_ASSINATURA') {
    return !sol.ass_aluno || !sol.ass_concedente ? 1 : 0;
  }
  return 0;
}

/* ------------------------------------------------------------------ detalhe */

function detalhar(user, id) {
  const ctx = obterContextoVisivel(user, id);
  const db = getDb();
  const historico = db
    .prepare(
      `SELECT h.*, u.nome AS autor_nome, u.perfil AS autor_perfil FROM historico_status h
         JOIN usuario u ON u.id = h.autor_id WHERE h.solicitacao_id = ? ORDER BY h.id`
    )
    .all(ctx.sol.id);
  const { sol } = ctx;
  const permissoes = permissoesOperacionais(user, ctx);
  return {
    solicitacao: sol,
    plano: ctx.plano,
    documentos: ctx.documentos.map(({ caminho_seguro, ...d }) => d),
    pareceres: ctx.pareceres,
    horas: ctx.horas,
    relatorios: ctx.relatorios,
    historico,
    resumo_horas: {
      previstas: Number(ctx.plano.horas_previstas || 0),
      registradas: ctx.horas.reduce((s, h) => s + Number(h.horas), 0),
      validadas: R.horasValidadas(ctx),
      parciais_exigidos: sol.modalidade === 'REGULAR' ? R.parciaisExigidos(ctx.plano) : 0,
    },
    pendencias: user.perfil === 'ALUNO' || user.perfil === 'SECRETARIA' ? R.pendencias(ctx) : [],
    acoes: acoesDisponiveis(user, ctx),
    permissoes,
    tipos_documento_permitidos: C.DOCUMENTOS_POR_MODALIDADE[sol.modalidade],
    documentos_obrigatorios: C.DOCUMENTOS_OBRIGATORIOS[sol.modalidade],
  };
}

/** O que o usuário pode fazer além das transições (a interface usa para exibir botões). */
function permissoesOperacionais(user, ctx) {
  const { sol } = ctx;
  const dono = user.perfil === 'ALUNO' && sol.aluno_usuario_id === user.id;
  const profResp = user.perfil === 'PROFESSOR' && sol.professor_id === user.id;
  const correcaoDocumental = sol.status === 'AGUARDANDO_CORRECAO' && sol.retorno_status !== 'EM_AVALIACAO_FINAL';
  return {
    editar: dono && (sol.status === 'RASCUNHO' || correcaoDocumental),
    anexar: (dono && (sol.status === 'RASCUNHO' || correcaoDocumental)) || (user.perfil === 'SECRETARIA' && ['EM_CONFERENCIA', 'AGUARDANDO_ASSINATURA'].includes(sol.status)),
    conferir_documentos: user.perfil === 'SECRETARIA' && sol.status === 'EM_CONFERENCIA',
    editar_conferencia: user.perfil === 'SECRETARIA' && ['EM_CONFERENCIA', 'AGUARDANDO_ASSINATURA'].includes(sol.status) && sol.modalidade === 'REGULAR',
    registrar_horas: dono && sol.status === 'EM_EXECUCAO',
    validar_horas: profResp && ['EM_EXECUCAO', 'EM_AVALIACAO_FINAL'].includes(sol.status),
    enviar_relatorio: dono && (sol.status === 'EM_EXECUCAO' || (sol.status === 'AGUARDANDO_CORRECAO' && sol.retorno_status === 'EM_AVALIACAO_FINAL')),
    avaliar_relatorio: profResp && ['EM_EXECUCAO', 'EM_AVALIACAO_FINAL'].includes(sol.status),
  };
}

/* ------------------------------------------------------------------ criação e edição */

function camposEditaveis(body) {
  return {
    concedente_id: body.concedente_id ? Number(body.concedente_id) : null,
    tipo_atividade: texto(body.tipo_atividade, 40),
    orientador_nome: texto(body.orientador_nome, 200),
    empresa_vinculo: texto(body.empresa_vinculo, 200),
    plano: {
      descricao: texto(body.plano?.descricao),
      tecnicas: texto(body.plano?.tecnicas),
      compatibilidade: texto(body.plano?.compatibilidade),
      periodo_inicio: data(body.plano?.periodo_inicio, 'período de início'),
      periodo_fim: data(body.plano?.periodo_fim, 'período de fim'),
      horas_previstas: inteiro(body.plano?.horas_previstas, 'horas previstas'),
    },
  };
}

function validarReferencias(campos) {
  const db = getDb();
  if (campos.concedente_id && !db.prepare('SELECT id FROM concedente WHERE id = ? AND ativo = 1').get(campos.concedente_id)) {
    throw badRequest('Concedente inválida ou inativa.');
  }
  if (campos.tipo_atividade && !C.TIPOS_ATIVIDADE_ACADEMICA[campos.tipo_atividade]) throw badRequest('Tipo de atividade acadêmica inválido.');
}

function criar(user, body) {
  const aluno = alunoDoUsuario(user.id);
  // RN-02: modalidade e curso identificados antes de abrir a solicitação.
  if (!C.MODALIDADES[body.modalidade]) throw badRequest('Selecione a modalidade da solicitação (RN-02).');
  if (!aluno.curso_id) throw businessRule('Seu cadastro não possui curso vinculado (RN-02).');
  const campos = camposEditaveis(body);
  validarReferencias(campos);

  return transaction((conn) => {
    const { lastInsertRowid } = conn
      .prepare(
        `INSERT INTO solicitacao (aluno_id, modalidade, concedente_id, tipo_atividade, orientador_nome, empresa_vinculo, criada_em, atualizada_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(aluno.id, body.modalidade, campos.concedente_id, campos.tipo_atividade, campos.orientador_nome, campos.empresa_vinculo, now(), now());
    const id = Number(lastInsertRowid);
    const p = campos.plano;
    conn
      .prepare(
        `INSERT INTO plano_atividade (solicitacao_id, descricao, tecnicas, compatibilidade, periodo_inicio, periodo_fim, horas_previstas)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, p.descricao, p.tecnicas, p.compatibilidade, p.periodo_inicio, p.periodo_fim, p.horas_previstas);
    conn
      .prepare("INSERT INTO historico_status (solicitacao_id, status_anterior, status_novo, acao, autor_id, data_hora) VALUES (?, NULL, 'RASCUNHO', 'criar', ?, ?)")
      .run(id, user.id, now());
    audit(user.id, 'SOLICITACAO_CRIADA', 'solicitacao', id, { modalidade: body.modalidade });
    return { id };
  });
}

function atualizar(user, id, body) {
  const ctx = obterContextoVisivel(user, id);
  if (!permissoesOperacionais(user, ctx).editar) {
    throw businessRule('A solicitação só pode ser editada pelo aluno em rascunho ou quando devolvida para correção.');
  }
  const campos = camposEditaveis(body);
  validarReferencias(campos);
  transaction((conn) => {
    conn
      .prepare('UPDATE solicitacao SET concedente_id = ?, tipo_atividade = ?, orientador_nome = ?, empresa_vinculo = ?, atualizada_em = ? WHERE id = ?')
      .run(campos.concedente_id, campos.tipo_atividade, campos.orientador_nome, campos.empresa_vinculo, now(), ctx.sol.id);
    const p = campos.plano;
    conn
      .prepare(
        'UPDATE plano_atividade SET descricao = ?, tecnicas = ?, compatibilidade = ?, periodo_inicio = ?, periodo_fim = ?, horas_previstas = ? WHERE solicitacao_id = ?'
      )
      .run(p.descricao, p.tecnicas, p.compatibilidade, p.periodo_inicio, p.periodo_fim, p.horas_previstas, ctx.sol.id);
    audit(user.id, 'SOLICITACAO_EDITADA', 'solicitacao', ctx.sol.id, { antes: { ...ctx.plano, concedente_id: ctx.sol.concedente_id }, depois: { ...p, concedente_id: campos.concedente_id } });
  });
  return { id: ctx.sol.id };
}

/* ------------------------------------------------------------------ documentos */

function removerArquivo(file) {
  if (file?.path) fs.rmSync(file.path, { force: true });
}

function anexarDocumento(user, id, tipo, file) {
  try {
    const ctx = obterContextoVisivel(user, id);
    if (!permissoesOperacionais(user, ctx).anexar) throw businessRule('Não é possível anexar documentos nesta etapa ou com seu perfil.');
    // RN-15: tipo de documento compatível com a modalidade.
    if (!C.DOCUMENTOS_POR_MODALIDADE[ctx.sol.modalidade].includes(tipo)) {
      throw badRequest(`Tipo de documento não aceito para ${C.MODALIDADES[ctx.sol.modalidade]}.`);
    }
    return transaction((conn) => inserirDocumento(conn, user, ctx, tipo, file));
  } catch (err) {
    removerArquivo(file);
    throw err;
  }
}

/** CA-04: nova versão é armazenada e a anterior permanece no histórico como SUBSTITUIDO. */
function inserirDocumento(conn, user, ctx, tipo, file) {
  const anterior = conn
    .prepare("SELECT id, versao FROM documento WHERE solicitacao_id = ? AND tipo = ? AND status <> 'SUBSTITUIDO' ORDER BY versao DESC LIMIT 1")
    .get(ctx.sol.id, tipo);
  const versao = (conn.prepare('SELECT MAX(versao) AS v FROM documento WHERE solicitacao_id = ? AND tipo = ?').get(ctx.sol.id, tipo).v || 0) + 1;
  if (anterior && tipo !== 'OUTRO') conn.prepare("UPDATE documento SET status = 'SUBSTITUIDO' WHERE id = ?").run(anterior.id);
  const nomeOriginal = file.originalname.replace(/[^\w.\- ()À-ú]/g, '_').slice(0, 150);
  const { lastInsertRowid } = conn
    .prepare(
      `INSERT INTO documento (solicitacao_id, tipo, versao, nome_arquivo, caminho_seguro, mime_type, tamanho_bytes, enviado_por, data_envio)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(ctx.sol.id, tipo, versao, nomeOriginal, file.filename, file.mimetype, file.size, user.id, now());
  conn.prepare('UPDATE solicitacao SET atualizada_em = ? WHERE id = ?').run(now(), ctx.sol.id);
  audit(user.id, 'DOCUMENTO_ENVIADO', 'solicitacao', ctx.sol.id, { documento_id: Number(lastInsertRowid), tipo, versao, substituiu: anterior?.id || null });
  return { id: Number(lastInsertRowid), versao };
}

/** Download protegido: verifica a titularidade/visibilidade da solicitação (RNF-01). */
function obterArquivo(user, documentoId) {
  const doc = getDb().prepare('SELECT * FROM documento WHERE id = ?').get(Number(documentoId));
  if (!doc) throw notFound('Documento não encontrado.');
  obterContextoVisivel(user, doc.solicitacao_id);
  audit(user.id, 'DOCUMENTO_BAIXADO', 'solicitacao', doc.solicitacao_id, { documento_id: doc.id });
  return doc;
}

function conferirDocumento(user, documentoId, body) {
  const doc = getDb().prepare('SELECT * FROM documento WHERE id = ?').get(Number(documentoId));
  if (!doc) throw notFound('Documento não encontrado.');
  const ctx = obterContextoVisivel(user, doc.solicitacao_id);
  if (!permissoesOperacionais(user, ctx).conferir_documentos) throw businessRule('A conferência de documentos é feita pela Secretaria durante a etapa "Em conferência".');
  if (C.TIPOS_RELATORIO_DOC.includes(doc.tipo)) throw businessRule('Relatórios são avaliados pelo professor responsável.');
  if (doc.status === 'SUBSTITUIDO') throw businessRule('Esta versão foi substituída por uma mais recente.');
  if (!['CONFERIDO', 'REJEITADO'].includes(body.status)) throw badRequest('Status de conferência inválido.');
  const observacao = texto(body.observacao, 1000);
  if (body.status === 'REJEITADO' && !observacao) throw badRequest('Informe o motivo da rejeição do documento.');
  getDb()
    .prepare('UPDATE documento SET status = ?, observacao = ?, conferido_por = ?, conferido_em = ? WHERE id = ?')
    .run(body.status, observacao, user.id, now(), doc.id);
  audit(user.id, 'DOCUMENTO_CONFERIDO', 'solicitacao', doc.solicitacao_id, { documento_id: doc.id, status: body.status, observacao });
  return { id: doc.id, status: body.status };
}

/** RN-03 / RN-08: dados de seguro e vias assinadas — somente Secretaria (aluno não declara seguro). */
function atualizarConferencia(user, id, body) {
  const ctx = obterContextoVisivel(user, id);
  if (!permissoesOperacionais(user, ctx).editar_conferencia) throw businessRule('Dados de conferência só podem ser alterados pela Secretaria nas etapas de conferência ou assinatura.');
  if (body.seguro_situacao !== undefined && !C.SEGURO[body.seguro_situacao]) throw badRequest('Situação de seguro inválida.');
  const novo = {
    seguro_situacao: body.seguro_situacao ?? ctx.sol.seguro_situacao,
    seguro_apolice: body.seguro_apolice !== undefined ? texto(body.seguro_apolice, 100) : ctx.sol.seguro_apolice,
    seguro_responsavel: body.seguro_responsavel !== undefined ? texto(body.seguro_responsavel, 200) : ctx.sol.seguro_responsavel,
    ass_aluno: body.ass_aluno !== undefined ? (body.ass_aluno ? 1 : 0) : ctx.sol.ass_aluno,
    ass_concedente: body.ass_concedente !== undefined ? (body.ass_concedente ? 1 : 0) : ctx.sol.ass_concedente,
  };
  getDb()
    .prepare('UPDATE solicitacao SET seguro_situacao = ?, seguro_apolice = ?, seguro_responsavel = ?, ass_aluno = ?, ass_concedente = ?, atualizada_em = ? WHERE id = ?')
    .run(novo.seguro_situacao, novo.seguro_apolice, novo.seguro_responsavel, novo.ass_aluno, novo.ass_concedente, now(), ctx.sol.id);
  audit(user.id, 'CONFERENCIA_ATUALIZADA', 'solicitacao', ctx.sol.id, {
    antes: { seguro_situacao: ctx.sol.seguro_situacao, seguro_responsavel: ctx.sol.seguro_responsavel, ass_aluno: ctx.sol.ass_aluno, ass_concedente: ctx.sol.ass_concedente },
    depois: novo,
  });
  return novo;
}

/* ------------------------------------------------------------------ horas */

function registrarHoras(user, id, body) {
  const ctx = obterContextoVisivel(user, id);
  if (!permissoesOperacionais(user, ctx).registrar_horas) throw businessRule('Horas só podem ser registradas pelo aluno com o estágio em execução.');
  const dia = data(body.data, 'data');
  const horas = Number(body.horas);
  const descricao = texto(body.descricao, 1000);
  if (!dia) throw badRequest('Informe a data da atividade.');
  if (!(horas > 0 && horas <= 12)) throw badRequest('Horas por registro devem estar entre 0 e 12.');
  if (!descricao) throw badRequest('Descreva a atividade realizada.');
  const { periodo_inicio: ini, periodo_fim: fim } = ctx.plano;
  if ((ini && dia < ini) || (fim && dia > fim)) throw businessRule(`A data deve estar dentro do período do estágio (${ini} a ${fim}).`);
  if (dia > new Date().toISOString().slice(0, 10)) throw businessRule('Não é possível registrar horas em data futura.');
  const { lastInsertRowid } = getDb()
    .prepare('INSERT INTO registro_hora (solicitacao_id, data, horas, descricao, criado_em) VALUES (?, ?, ?, ?, ?)')
    .run(ctx.sol.id, dia, horas, descricao, now());
  audit(user.id, 'HORAS_REGISTRADAS', 'solicitacao', ctx.sol.id, { registro_id: Number(lastInsertRowid), data: dia, horas });
  return { id: Number(lastInsertRowid) };
}

function validarHoras(user, registroId, body) {
  const reg = getDb().prepare('SELECT * FROM registro_hora WHERE id = ?').get(Number(registroId));
  if (!reg) throw notFound('Registro de horas não encontrado.');
  const ctx = obterContextoVisivel(user, reg.solicitacao_id);
  if (!permissoesOperacionais(user, ctx).validar_horas) throw forbidden('Somente o professor responsável valida horas durante a execução.');
  if (!['VALIDADO', 'RECUSADO'].includes(body.validado)) throw badRequest('Resultado de validação inválido.');
  const observacao = texto(body.observacao, 1000);
  if (body.validado === 'RECUSADO' && !observacao) throw badRequest('Informe o motivo da recusa.');
  getDb().prepare('UPDATE registro_hora SET validado = ?, validado_por = ?, observacao = ? WHERE id = ?').run(body.validado, user.id, observacao, reg.id);
  audit(user.id, 'HORAS_VALIDADAS', 'solicitacao', reg.solicitacao_id, { registro_id: reg.id, validado: body.validado, observacao });
  return { id: reg.id, validado: body.validado };
}

/* ------------------------------------------------------------------ relatórios */

function enviarRelatorio(user, id, body, file) {
  try {
    const ctx = obterContextoVisivel(user, id);
    if (ctx.sol.modalidade !== 'REGULAR') throw businessRule('Relatórios de acompanhamento se aplicam ao estágio regular.');
    if (!permissoesOperacionais(user, ctx).enviar_relatorio) throw businessRule('Relatórios são enviados pelo aluno durante a execução do estágio ou na correção do relatório final.');
    const tipo = body.tipo;
    if (!['PARCIAL', 'FINAL'].includes(tipo)) throw badRequest('Tipo de relatório inválido.');
    const periodo = texto(body.periodo, 100);
    if (!periodo) throw badRequest('Informe o período de referência do relatório.');
    if (ctx.sol.status === 'AGUARDANDO_CORRECAO' && tipo !== 'FINAL') throw businessRule('Nesta etapa envie a nova versão do relatório final.');

    return transaction((conn) => {
      const doc = inserirDocumento(conn, user, ctx, tipo === 'FINAL' ? 'RELATORIO_FINAL' : 'RELATORIO_PARCIAL', file);
      // Nova versão substitui o relatório devolvido/pendente do mesmo tipo (final) ou o devolvido mais antigo (parcial).
      const substituir =
        tipo === 'FINAL'
          ? conn.prepare("SELECT id FROM relatorio WHERE solicitacao_id = ? AND tipo = 'FINAL' AND estado_avaliacao IN ('PENDENTE','DEVOLVIDO')").all(ctx.sol.id)
          : conn.prepare("SELECT id FROM relatorio WHERE solicitacao_id = ? AND tipo = 'PARCIAL' AND estado_avaliacao = 'DEVOLVIDO' ORDER BY id LIMIT 1").all(ctx.sol.id);
      for (const r of substituir) conn.prepare("UPDATE relatorio SET estado_avaliacao = 'SUBSTITUIDO' WHERE id = ?").run(r.id);
      const { lastInsertRowid } = conn
        .prepare('INSERT INTO relatorio (solicitacao_id, tipo, periodo, arquivo_id, enviado_em) VALUES (?, ?, ?, ?, ?)')
        .run(ctx.sol.id, tipo, periodo, doc.id, now());
      audit(user.id, 'RELATORIO_ENVIADO', 'solicitacao', ctx.sol.id, { relatorio_id: Number(lastInsertRowid), tipo, periodo });
      return { id: Number(lastInsertRowid) };
    });
  } catch (err) {
    removerArquivo(file);
    throw err;
  }
}

/** CA-10: relatório final devolvido retorna a solicitação para correção e bloqueia a conclusão. */
function avaliarRelatorio(user, relatorioId, body) {
  const rel = getDb().prepare('SELECT * FROM relatorio WHERE id = ?').get(Number(relatorioId));
  if (!rel) throw notFound('Relatório não encontrado.');
  const ctx = obterContextoVisivel(user, rel.solicitacao_id);
  if (!permissoesOperacionais(user, ctx).avaliar_relatorio) throw forbidden('Somente o professor responsável avalia relatórios durante a execução ou avaliação final.');
  if (rel.estado_avaliacao !== 'PENDENTE') throw businessRule('Este relatório já foi avaliado.');
  if (!['APROVADO', 'DEVOLVIDO'].includes(body.estado)) throw badRequest('Resultado de avaliação inválido.');
  const observacao = texto(body.observacao, 2000);
  if (body.estado === 'DEVOLVIDO' && !observacao) throw badRequest('Informe o motivo da devolução do relatório.');

  return transaction((conn) => {
    conn
      .prepare('UPDATE relatorio SET estado_avaliacao = ?, avaliado_por = ?, observacao = ?, avaliado_em = ? WHERE id = ?')
      .run(body.estado, user.id, observacao, now(), rel.id);
    audit(user.id, 'RELATORIO_AVALIADO', 'solicitacao', rel.solicitacao_id, { relatorio_id: rel.id, estado: body.estado, observacao });
    if (rel.tipo === 'FINAL') {
      conn
        .prepare('INSERT INTO parecer (solicitacao_id, avaliador_id, tipo, resultado, justificativa, data) VALUES (?, ?, ?, ?, ?, ?)')
        .run(rel.solicitacao_id, user.id, 'FINAL', body.estado === 'APROVADO' ? 'RELATORIO_FINAL_APROVADO' : 'RELATORIO_FINAL_DEVOLVIDO', observacao || 'Relatório final aprovado.', now());
    }
    if (body.estado === 'DEVOLVIDO' && rel.tipo === 'FINAL' && ctx.sol.status === 'EM_AVALIACAO_FINAL') {
      conn.prepare("UPDATE solicitacao SET retorno_status = 'EM_AVALIACAO_FINAL' WHERE id = ?").run(ctx.sol.id);
      registrarTransicao(conn, ctx, user, 'devolver_relatorio', 'AGUARDANDO_CORRECAO', `Relatório final devolvido: ${observacao}`);
    }
    return { id: rel.id, estado: body.estado };
  });
}

module.exports = {
  listar,
  detalhar,
  criar,
  atualizar,
  anexarDocumento,
  obterArquivo,
  conferirDocumento,
  atualizarConferencia,
  registrarHoras,
  validarHoras,
  enviarRelatorio,
  avaliarRelatorio,
  obterContextoVisivel,
  tarefasOperacionais,
};
