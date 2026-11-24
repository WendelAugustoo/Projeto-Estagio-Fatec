/**
 * Máquina de estados do workflow de solicitações (RF-07, RN-14).
 *
 * Cada ação declara: estados de origem, quem pode executá-la, se exige motivo,
 * as regras de negócio que a bloqueiam e o estado de destino. O backend é a
 * única fonte de verdade: a interface apenas exibe as ações devolvidas por
 * `acoesDisponiveis` e o servidor revalida tudo em `executarAcao`.
 */
const { getDb, transaction } = require('../db');
const { audit, now } = require('../utils/audit');
const { forbidden, businessRule, badRequest, notFound } = require('../utils/errors');
const { STATUS, STATUS_FINAIS } = require('./constants');
const { carregarContexto, podeVisualizar } = require('./contexto');
const R = require('./regras');

const ehDono = (user, ctx) => user.perfil === 'ALUNO' && ctx.sol.aluno_usuario_id === user.id;
const ehProfessorResponsavel = (user, ctx) => user.perfil === 'PROFESSOR' && ctx.sol.professor_id === user.id;
const temPerfil = (user, ...perfis) => perfis.includes(user.perfil);

function outrasSolicitacoesDoAluno(alunoId) {
  return getDb().prepare('SELECT id, modalidade, status, protocolo FROM solicitacao WHERE aluno_id = ?').all(alunoId);
}

function gerarProtocolo(conn, id) {
  const ano = new Date().getUTCFullYear();
  return `EST-${ano}-${String(id).padStart(6, '0')}`;
}

function registrarParecer(conn, ctx, user, tipo, resultado, justificativa, horasSugeridas = null) {
  conn
    .prepare('INSERT INTO parecer (solicitacao_id, avaliador_id, tipo, resultado, horas_sugeridas, justificativa, data) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(ctx.sol.id, user.id, tipo, resultado, horasSugeridas, justificativa, now());
  audit(user.id, 'PARECER_REGISTRADO', 'solicitacao', ctx.sol.id, { tipo, resultado, horasSugeridas });
}

const ACOES = {
  enviar: {
    rotulo: 'Enviar para conferência',
    de: ['RASCUNHO'],
    permitido: ehDono,
    bloqueios: (ctx) => [...R.regraCompletude(ctx), ...R.regraEstagioAnterior(ctx, outrasSolicitacoesDoAluno(ctx.sol.aluno_id))],
    destino: () => 'ENVIADO',
    efeito: (conn, ctx) => {
      const protocolo = ctx.sol.protocolo || gerarProtocolo(conn, ctx.sol.id);
      conn.prepare('UPDATE solicitacao SET protocolo = ?, enviada_em = ? WHERE id = ?').run(protocolo, now(), ctx.sol.id);
    },
  },

  cancelar: {
    rotulo: 'Cancelar solicitação',
    secundaria: true,
    de: ['RASCUNHO', 'AGUARDANDO_CORRECAO'],
    permitido: ehDono,
    motivo: 'obrigatorio',
    perigo: true,
    destino: () => 'CANCELADO',
    efeito: (conn, ctx) => conn.prepare('UPDATE solicitacao SET encerrada_em = ? WHERE id = ?').run(now(), ctx.sol.id),
  },

  iniciar_conferencia: {
    rotulo: 'Iniciar conferência',
    de: ['ENVIADO'],
    permitido: (user) => temPerfil(user, 'SECRETARIA'),
    destino: () => 'EM_CONFERENCIA',
  },

  retomar: {
    rotulo: 'Retomar análise do reenvio',
    de: ['REENVIADO'],
    permitido: (user, ctx) =>
      ctx.sol.retorno_status === 'EM_AVALIACAO_FINAL' ? ehProfessorResponsavel(user, ctx) : temPerfil(user, 'SECRETARIA'),
    destino: (ctx) => ctx.sol.retorno_status || 'EM_CONFERENCIA',
    efeito: (conn, ctx) => conn.prepare('UPDATE solicitacao SET retorno_status = NULL WHERE id = ?').run(ctx.sol.id),
  },

  encaminhar_analise: {
    rotulo: 'Encaminhar para análise acadêmica',
    de: ['EM_CONFERENCIA'],
    permitido: (user) => temPerfil(user, 'SECRETARIA'),
    campos: ['professor_id'],
    bloqueios: (ctx) => [...R.regraMatricula(ctx), ...R.regraConferenciaDocumentos(ctx), ...R.regraSeguro(ctx)],
    validar: (ctx, payload) => {
      const professorId = Number(payload.professor_id || ctx.sol.professor_id);
      if (!professorId) return ['Selecione o professor responsável pela análise.'];
      const prof = getDb().prepare("SELECT id FROM usuario WHERE id = ? AND perfil = 'PROFESSOR' AND ativo = 1").get(professorId);
      return prof ? [] : ['Professor responsável inválido ou inativo.'];
    },
    destino: () => 'EM_ANALISE_ACADEMICA',
    efeito: (conn, ctx, user, payload) => {
      const professorId = Number(payload.professor_id || ctx.sol.professor_id);
      conn.prepare('UPDATE solicitacao SET professor_id = ? WHERE id = ?').run(professorId, ctx.sol.id);
    },
  },

  devolver: {
    rotulo: 'Devolver para correção',
    secundaria: true,
    de: ['EM_CONFERENCIA', 'EM_ANALISE_ACADEMICA', 'AGUARDANDO_ASSINATURA', 'EM_AVALIACAO_FINAL'],
    permitido: (user, ctx) => {
      switch (ctx.sol.status) {
        case 'EM_CONFERENCIA':
          return temPerfil(user, 'SECRETARIA');
        case 'EM_ANALISE_ACADEMICA':
          return ehProfessorResponsavel(user, ctx) || temPerfil(user, 'COORDENACAO');
        case 'AGUARDANDO_ASSINATURA':
          return temPerfil(user, 'DIRECAO', 'SECRETARIA');
        case 'EM_AVALIACAO_FINAL':
          return ehProfessorResponsavel(user, ctx) || temPerfil(user, 'SECRETARIA');
        default:
          return false;
      }
    },
    motivo: 'obrigatorio',
    destino: () => 'AGUARDANDO_CORRECAO',
    efeito: (conn, ctx, user, payload) => {
      const retorno = ctx.sol.status === 'EM_AVALIACAO_FINAL' ? 'EM_AVALIACAO_FINAL' : 'EM_CONFERENCIA';
      conn.prepare('UPDATE solicitacao SET retorno_status = ? WHERE id = ?').run(retorno, ctx.sol.id);
      // RN-06: devolução do PAE pelo professor gera parecer técnico justificado.
      if (ctx.sol.status === 'EM_ANALISE_ACADEMICA') {
        const tipo = user.perfil === 'PROFESSOR' ? 'TECNICO' : 'ACADEMICO';
        registrarParecer(conn, ctx, user, tipo, 'AJUSTES_NECESSARIOS', payload.motivo);
      }
      // Ao voltar para correção, a Direção precisará assinar novamente.
      if (ctx.sol.status === 'AGUARDANDO_ASSINATURA') {
        conn.prepare('UPDATE solicitacao SET ass_coordenacao = 0 WHERE id = ?').run(ctx.sol.id);
      }
    },
  },

  reenviar: {
    rotulo: 'Reenviar após correção',
    de: ['AGUARDANDO_CORRECAO'],
    permitido: ehDono,
    bloqueios: (ctx) => {
      if (ctx.sol.retorno_status === 'EM_AVALIACAO_FINAL') {
        const finais = ctx.relatorios.filter((r) => r.tipo === 'FINAL' && r.estado_avaliacao !== 'SUBSTITUIDO');
        const ultimo = finais[finais.length - 1];
        const erros = [];
        if (!ultimo || ultimo.estado_avaliacao !== 'PENDENTE') erros.push('Envie a nova versão do relatório final antes de reenviar.');
        if (ctx.relatorios.some((r) => r.estado_avaliacao === 'DEVOLVIDO')) erros.push('Há relatório devolvido sem nova versão.');
        return erros;
      }
      return R.regraCompletude(ctx);
    },
    destino: () => 'REENVIADO',
  },

  parecer_tecnico: {
    rotulo: 'Emitir parecer técnico',
    de: ['EM_ANALISE_ACADEMICA'],
    permitido: ehProfessorResponsavel,
    motivo: 'obrigatorio',
    rotuloMotivo: 'Justificativa do parecer',
    campos: (ctx) => (ctx.sol.modalidade === 'REGULAR' ? ['resultado_tecnico'] : ['resultado_tecnico', 'horas_sugeridas']),
    validar: (ctx, payload) => {
      const erros = [];
      if (!['FAVORAVEL', 'DESFAVORAVEL'].includes(payload.resultado)) erros.push('Informe o resultado do parecer (favorável ou desfavorável).');
      if (payload.horas_sugeridas !== undefined && payload.horas_sugeridas !== null && payload.horas_sugeridas !== '') {
        const h = Number(payload.horas_sugeridas);
        if (!Number.isInteger(h) || h < 0) erros.push('Horas sugeridas devem ser um número inteiro não negativo.');
      }
      return erros;
    },
    destino: () => null, // não altera o estado
    efeito: (conn, ctx, user, payload) =>
      registrarParecer(conn, ctx, user, 'TECNICO', payload.resultado, payload.motivo, payload.horas_sugeridas ? Number(payload.horas_sugeridas) : null),
  },

  aprovar_plano: {
    rotulo: 'Aprovar PAE e encaminhar para assinatura',
    de: ['EM_ANALISE_ACADEMICA'],
    permitido: (user, ctx) => temPerfil(user, 'COORDENACAO') && ctx.sol.modalidade === 'REGULAR',
    motivo: 'obrigatorio',
    rotuloMotivo: 'Parecer acadêmico',
    bloqueios: (ctx) => {
      const p = R.ultimoParecerTecnico(ctx);
      if (!p) return ['Aguardando parecer técnico do professor responsável.'];
      if (p.resultado !== 'FAVORAVEL') return ['O último parecer técnico não é favorável; devolva para ajustes ou indefira.'];
      return [];
    },
    destino: () => 'AGUARDANDO_ASSINATURA',
    efeito: (conn, ctx, user, payload) => {
      registrarParecer(conn, ctx, user, 'ACADEMICO', 'APROVADO', payload.motivo);
      conn.prepare('UPDATE solicitacao SET ass_coordenacao = 1 WHERE id = ?').run(ctx.sol.id);
    },
  },

  decidir: {
    rotulo: 'Registrar decisão de reconhecimento de horas',
    de: ['EM_ANALISE_ACADEMICA'],
    permitido: (user, ctx) => temPerfil(user, 'COORDENACAO') && ctx.sol.modalidade !== 'REGULAR',
    motivo: 'obrigatorio',
    rotuloMotivo: 'Justificativa da decisão',
    campos: ['resultado_decisao', 'horas_reconhecidas'],
    bloqueios: (ctx) => (R.ultimoParecerTecnico(ctx) ? [] : ['Aguardando parecer técnico do professor responsável.']),
    validar: (ctx, payload) => {
      const erros = [];
      const solicitadas = Number(ctx.plano.horas_previstas || 0);
      if (!['DEFERIDO', 'DEFERIDO_PARCIAL', 'INDEFERIDO'].includes(payload.resultado)) {
        erros.push('Informe o resultado: deferido integralmente, parcialmente ou indeferido (RN-13).');
      }
      // RN-12 / CA-07: equiparação só pode ser deferida se prevista no PPC do curso.
      if (ctx.sol.modalidade === 'EQUIPARACAO' && !ctx.sol.permite_equiparacao && payload.resultado !== 'INDEFERIDO') {
        erros.push(`O PPC do curso ${ctx.sol.curso_nome} não prevê equiparação de atividades acadêmicas. O deferimento automático está bloqueado: a solicitação deve ser indeferida ou tratada pela regra institucional (RN-12).`);
      }
      if (payload.resultado === 'DEFERIDO_PARCIAL') {
        const h = Number(payload.horas_reconhecidas);
        if (!Number.isInteger(h) || h <= 0 || h >= solicitadas) {
          erros.push(`No deferimento parcial, as horas reconhecidas devem ser maiores que 0 e menores que as ${solicitadas}h solicitadas.`);
        }
      }
      return erros;
    },
    destino: (ctx, payload) => payload.resultado,
    efeito: (conn, ctx, user, payload) => {
      const solicitadas = Number(ctx.plano.horas_previstas || 0);
      const horas = payload.resultado === 'DEFERIDO' ? solicitadas : payload.resultado === 'INDEFERIDO' ? 0 : Number(payload.horas_reconhecidas);
      registrarParecer(conn, ctx, user, 'ACADEMICO', payload.resultado, payload.motivo, horas);
      conn.prepare('UPDATE solicitacao SET horas_reconhecidas = ?, encerrada_em = ? WHERE id = ?').run(horas, now(), ctx.sol.id);
    },
  },

  indeferir: {
    rotulo: 'Indeferir solicitação',
    secundaria: true,
    de: ['EM_CONFERENCIA', 'EM_ANALISE_ACADEMICA'],
    permitido: (user, ctx) =>
      ctx.sol.status === 'EM_CONFERENCIA' ? temPerfil(user, 'SECRETARIA') : temPerfil(user, 'COORDENACAO') && ctx.sol.modalidade === 'REGULAR',
    motivo: 'obrigatorio',
    perigo: true,
    destino: () => 'INDEFERIDO',
    efeito: (conn, ctx, user, payload) => {
      if (ctx.sol.status === 'EM_ANALISE_ACADEMICA') registrarParecer(conn, ctx, user, 'ACADEMICO', 'INDEFERIDO', payload.motivo);
      conn.prepare('UPDATE solicitacao SET encerrada_em = ? WHERE id = ?').run(now(), ctx.sol.id);
    },
  },

  assinar: {
    rotulo: 'Registrar assinatura da Direção (simulação)',
    de: ['AGUARDANDO_ASSINATURA'],
    permitido: (user) => temPerfil(user, 'DIRECAO'),
    motivo: 'opcional',
    rotuloMotivo: 'Observação',
    bloqueios: R.regraAssinaturasAnteriores,
    destino: () => 'FORMALIZADO',
    efeito: (conn, ctx) => conn.prepare('UPDATE solicitacao SET ass_direcao = 1 WHERE id = ?').run(ctx.sol.id),
  },

  liberar: {
    rotulo: 'Registrar liberação do estágio',
    de: ['FORMALIZADO'],
    permitido: (user) => temPerfil(user, 'SECRETARIA'),
    motivo: 'opcional',
    rotuloMotivo: 'Observação',
    destino: () => 'EM_EXECUCAO',
  },

  solicitar_avaliacao_final: {
    rotulo: 'Solicitar avaliação final',
    de: ['EM_EXECUCAO'],
    permitido: ehDono,
    bloqueios: R.regraRelatoriosParaAvaliacao,
    destino: () => 'EM_AVALIACAO_FINAL',
  },

  concluir: {
    rotulo: 'Registrar encerramento do estágio',
    de: ['EM_AVALIACAO_FINAL'],
    permitido: (user) => temPerfil(user, 'SECRETARIA'),
    motivo: 'opcional',
    rotuloMotivo: 'Observação',
    bloqueios: R.regraConclusao,
    destino: () => 'CONCLUIDO',
    efeito: (conn, ctx) =>
      conn.prepare('UPDATE solicitacao SET horas_reconhecidas = ?, encerrada_em = ? WHERE id = ?').run(R.horasValidadas(ctx), now(), ctx.sol.id),
  },
};

function camposDaAcao(def, ctx) {
  if (!def.campos) return [];
  return typeof def.campos === 'function' ? def.campos(ctx) : def.campos;
}

/** Ações que o usuário pode executar agora, com eventuais bloqueios de regra. */
function acoesDisponiveis(user, ctx) {
  if (STATUS_FINAIS.includes(ctx.sol.status)) return [];
  const lista = [];
  for (const [acao, def] of Object.entries(ACOES)) {
    if (!def.de.includes(ctx.sol.status)) continue;
    if (!def.permitido(user, ctx)) continue;
    lista.push({
      acao,
      rotulo: def.rotulo,
      motivo: def.motivo || false,
      rotuloMotivo: def.rotuloMotivo || 'Motivo',
      campos: camposDaAcao(def, ctx),
      perigo: Boolean(def.perigo),
      secundaria: Boolean(def.secundaria),
      destino: def.destino(ctx, {}),
      bloqueios: def.bloqueios ? def.bloqueios(ctx) : [],
    });
  }
  return lista;
}

/** Grava a transição de estado e o histórico (RNF-06). */
function registrarTransicao(conn, ctx, user, acao, novoStatus, motivo) {
  conn.prepare('UPDATE solicitacao SET status = ?, atualizada_em = ? WHERE id = ?').run(novoStatus, now(), ctx.sol.id);
  conn
    .prepare('INSERT INTO historico_status (solicitacao_id, status_anterior, status_novo, acao, autor_id, motivo, data_hora) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(ctx.sol.id, ctx.sol.status, novoStatus, acao, user.id, motivo || null, now());
  audit(user.id, 'TRANSICAO_STATUS', 'solicitacao', ctx.sol.id, { acao, de: ctx.sol.status, para: novoStatus, motivo: motivo || null });
}

/** Executa uma ação do workflow com todas as validações no servidor. */
function executarAcao(user, solicitacaoId, acao, payload = {}) {
  const def = ACOES[acao];
  if (!def) throw notFound(`Ação desconhecida: ${acao}.`);

  return transaction((conn) => {
    const ctx = carregarContexto(solicitacaoId);
    if (!podeVisualizar(user, ctx.sol)) throw notFound('Solicitação não encontrada.');

    if (STATUS_FINAIS.includes(ctx.sol.status) || !def.de.includes(ctx.sol.status)) {
      audit(user.id, 'TRANSICAO_RECUSADA', 'solicitacao', ctx.sol.id, { acao, status: ctx.sol.status });
      throw businessRule(`A ação "${def.rotulo}" não é permitida no estado atual (${STATUS[ctx.sol.status]}).`);
    }
    if (!def.permitido(user, ctx)) {
      audit(user.id, 'TRANSICAO_RECUSADA', 'solicitacao', ctx.sol.id, { acao, motivo: 'perfil sem permissão' });
      throw forbidden('Seu perfil não tem permissão para executar esta ação nesta solicitação.');
    }

    const motivo = typeof payload.motivo === 'string' ? payload.motivo.trim() : '';
    if (def.motivo === 'obrigatorio' && !motivo) throw badRequest(`Informe: ${(def.rotuloMotivo || 'motivo').toLowerCase()}.`);
    if (motivo.length > 2000) throw badRequest('O texto informado excede 2000 caracteres.');
    const dados = { ...payload, motivo };

    const erros = [...(def.bloqueios ? def.bloqueios(ctx) : []), ...(def.validar ? def.validar(ctx, dados) : [])];
    if (erros.length) throw businessRule('A ação não pode ser concluída por pendências de regra de negócio.', erros);

    const destino = def.destino(ctx, dados);
    if (def.efeito) def.efeito(conn, ctx, user, dados);
    if (destino) registrarTransicao(conn, ctx, user, acao, destino, motivo);
    else conn.prepare('UPDATE solicitacao SET atualizada_em = ? WHERE id = ?').run(now(), ctx.sol.id);

    return { status: destino || ctx.sol.status };
  });
}

module.exports = { ACOES, acoesDisponiveis, executarAcao, registrarTransicao };
