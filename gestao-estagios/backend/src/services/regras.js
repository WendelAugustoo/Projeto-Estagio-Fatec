/**
 * Regras de negócio puras (sem acesso a banco). Cada função recebe o contexto
 * carregado e devolve uma lista de pendências legíveis; lista vazia = regra atendida.
 */
const { DOCUMENTOS_OBRIGATORIOS, TIPOS_DOCUMENTO, TIPOS_RELATORIO_DOC, STATUS_FINAIS } = require('./constants');
const { documentosVigentes } = require('./contexto');

const DIA_MS = 24 * 60 * 60 * 1000;
const SEIS_MESES_DIAS = 183;

const vazio = (v) => v === undefined || v === null || String(v).trim() === '';

function diasEntre(inicio, fim) {
  return Math.round((new Date(fim + 'T00:00:00Z') - new Date(inicio + 'T00:00:00Z')) / DIA_MS);
}

/** RN-01: matrícula irregular bloqueia estágio regular. */
function regraMatricula(ctx) {
  if (ctx.sol.modalidade === 'REGULAR' && ctx.sol.situacao_matricula !== 'REGULAR') {
    return ['Matrícula registrada como IRREGULAR. Regularize sua matrícula na Secretaria antes de enviar a solicitação de estágio regular (RN-01).'];
  }
  return [];
}

/** RN-05 / RN-11 / equiparação: dados do plano obrigatórios por modalidade. */
function regraDadosPlano(ctx) {
  const { sol, plano } = ctx;
  const erros = [];
  if (sol.modalidade === 'REGULAR') {
    if (vazio(sol.concedente_id)) erros.push('Informe a empresa concedente.');
    if (vazio(plano.descricao)) erros.push('PAE: descreva as atividades a serem desenvolvidas (RN-05).');
    if (vazio(plano.tecnicas)) erros.push('PAE: informe as técnicas/ferramentas utilizadas (RN-05).');
    if (vazio(plano.compatibilidade)) erros.push('PAE: justifique a compatibilidade das atividades com o curso (RN-05).');
    if (vazio(plano.periodo_inicio) || vazio(plano.periodo_fim)) erros.push('PAE: informe o período de início e fim (RN-05).');
    if (!(Number(plano.horas_previstas) > 0)) erros.push('PAE: informe a carga horária prevista (RN-05).');
  } else if (sol.modalidade === 'EQUIVALENCIA') {
    if (vazio(sol.empresa_vinculo)) erros.push('Informe a empresa/empregador da experiência profissional (RN-11).');
    if (vazio(plano.descricao)) erros.push('Informe a descrição técnica das atividades profissionais (RN-11).');
    if (!(Number(plano.horas_previstas) > 0)) erros.push('Informe a carga horária a ser reconhecida (RN-11).');
    if (vazio(plano.periodo_inicio)) erros.push('Informe o período da experiência profissional (RN-11).');
  } else if (sol.modalidade === 'EQUIPARACAO') {
    if (vazio(sol.tipo_atividade)) erros.push('Informe o tipo de atividade acadêmica (IC, monitoria, pesquisa ou extensão).');
    if (vazio(sol.orientador_nome)) erros.push('Informe o professor orientador da atividade.');
    if (vazio(plano.descricao)) erros.push('Descreva a atividade acadêmica realizada.');
    if (!(Number(plano.horas_previstas) > 0)) erros.push('Informe a carga horária a ser equiparada.');
  }
  if (!vazio(plano.periodo_inicio) && !vazio(plano.periodo_fim) && plano.periodo_fim <= plano.periodo_inicio) {
    erros.push('A data de fim deve ser posterior à data de início.');
  }
  return erros;
}

/** RN-03 / RN-04: documentos obrigatórios presentes e não rejeitados. */
function regraDocumentos(ctx) {
  const erros = [];
  const vigentes = documentosVigentes(ctx).filter((d) => !TIPOS_RELATORIO_DOC.includes(d.tipo));
  for (const tipo of DOCUMENTOS_OBRIGATORIOS[ctx.sol.modalidade]) {
    if (!vigentes.some((d) => d.tipo === tipo)) erros.push(`Documento obrigatório ausente: ${TIPOS_DOCUMENTO[tipo]}.`);
  }
  for (const d of vigentes.filter((x) => x.status === 'REJEITADO')) {
    erros.push(`Documento rejeitado pela Secretaria — envie nova versão: ${TIPOS_DOCUMENTO[d.tipo]}${d.observacao ? ` (motivo: ${d.observacao})` : ''}.`);
  }
  return erros;
}

/** Completude exigida para enviar/reenviar à conferência. */
function regraCompletude(ctx) {
  return [...regraMatricula(ctx), ...regraDadosPlano(ctx), ...regraDocumentos(ctx)];
}

/** RN-10: só um estágio regular ativo por vez. `outras` = demais solicitações do aluno. */
function regraEstagioAnterior(ctx, outras) {
  if (ctx.sol.modalidade !== 'REGULAR') return [];
  const ativa = outras.find(
    (o) => o.id !== ctx.sol.id && o.modalidade === 'REGULAR' && o.status !== 'RASCUNHO' && !STATUS_FINAIS.includes(o.status)
  );
  if (ativa) {
    return [`Já existe um estágio regular em andamento (${ativa.protocolo || '#' + ativa.id}). Um novo estágio regular só pode ser liberado após a conclusão do anterior com a documentação entregue (RN-10).`];
  }
  return [];
}

/** RN-04: Secretaria só encaminha com todos os documentos conferidos. */
function regraConferenciaDocumentos(ctx) {
  const erros = regraDocumentos(ctx);
  const vigentes = documentosVigentes(ctx).filter((d) => !TIPOS_RELATORIO_DOC.includes(d.tipo));
  for (const d of vigentes.filter((x) => x.status === 'PENDENTE')) {
    erros.push(`Documento ainda não conferido: ${TIPOS_DOCUMENTO[d.tipo]} (v${d.versao}).`);
  }
  return erros;
}

/** RN-08: seguro registrado pela Secretaria antes da análise do estágio regular. */
function regraSeguro(ctx) {
  if (ctx.sol.modalidade === 'REGULAR' && ctx.sol.seguro_situacao === 'NAO_INFORMADO') {
    return ['Registre a situação do seguro contra acidentes pessoais e o responsável pela contratação (RN-08).'];
  }
  if (ctx.sol.modalidade === 'REGULAR' && ctx.sol.seguro_situacao !== 'NAO_APLICAVEL' && vazio(ctx.sol.seguro_responsavel)) {
    return ['Informe o responsável pela contratação do seguro (RN-08).'];
  }
  return [];
}

/** RN-07: Direção assina por último. */
function regraAssinaturasAnteriores(ctx) {
  const erros = [];
  if (!ctx.sol.ass_aluno) erros.push('Assinatura do aluno no TCE ainda não registrada pela Secretaria.');
  if (!ctx.sol.ass_concedente) erros.push('Assinatura da concedente no TCE ainda não registrada pela Secretaria.');
  if (!ctx.sol.ass_coordenacao) erros.push('Validação/assinatura da Coordenação ainda não registrada.');
  if (erros.length) erros.push('A Direção assina por último, após a conferência das assinaturas anteriores (RN-07).');
  return erros;
}

/** Último parecer técnico do professor responsável. */
function ultimoParecerTecnico(ctx) {
  return [...ctx.pareceres].reverse().find((p) => p.tipo === 'TECNICO');
}

/** RN-09: quantidade de relatórios parciais exigidos para o período do estágio. */
function parciaisExigidos(plano) {
  if (vazio(plano.periodo_inicio) || vazio(plano.periodo_fim)) return 0;
  const dias = diasEntre(plano.periodo_inicio, plano.periodo_fim);
  return Math.max(0, Math.ceil(dias / SEIS_MESES_DIAS) - 1);
}

const relatoriosValidos = (ctx, tipo) =>
  ctx.relatorios.filter((r) => r.tipo === tipo && !['DEVOLVIDO', 'SUBSTITUIDO'].includes(r.estado_avaliacao));

/** RN-09: relatório final enviado e parciais em intervalos não superiores a seis meses. */
function regraRelatoriosParaAvaliacao(ctx) {
  const erros = [];
  const exigidos = parciaisExigidos(ctx.plano);
  const parciais = relatoriosValidos(ctx, 'PARCIAL').length;
  if (parciais < exigidos) {
    erros.push(`São exigidos ${exigidos} relatório(s) parcial(is) para este período (intervalo máximo de seis meses); enviado(s): ${parciais} (RN-09).`);
  }
  if (!relatoriosValidos(ctx, 'FINAL').length) erros.push('Envie o relatório final antes de solicitar a avaliação final (RN-09).');
  if (!ctx.horas.length) erros.push('Registre as horas de estágio executadas.');
  return erros;
}

/** Condições para a Secretaria registrar o encerramento. */
function regraConclusao(ctx) {
  const erros = [];
  const finais = ctx.relatorios.filter((r) => r.tipo === 'FINAL' && r.estado_avaliacao !== 'SUBSTITUIDO');
  const ultimoFinal = finais[finais.length - 1];
  if (!ultimoFinal || ultimoFinal.estado_avaliacao !== 'APROVADO') erros.push('O relatório final precisa ser aprovado pelo professor responsável.');
  if (ctx.relatorios.some((r) => r.estado_avaliacao === 'DEVOLVIDO')) erros.push('Há relatório devolvido sem nova versão.');
  if (ctx.relatorios.some((r) => r.estado_avaliacao === 'PENDENTE')) erros.push('Há relatório aguardando avaliação do professor.');
  if (ctx.horas.some((h) => h.validado === 'PENDENTE')) erros.push('Há registros de horas aguardando validação do professor.');
  const validadas = horasValidadas(ctx);
  const previstas = Number(ctx.plano.horas_previstas || 0);
  if (validadas < previstas) erros.push(`Horas validadas (${validadas}h) inferiores à carga horária prevista no PAE (${previstas}h).`);
  return erros;
}

function horasValidadas(ctx) {
  return ctx.horas.filter((h) => h.validado === 'VALIDADO').reduce((s, h) => s + Number(h.horas), 0);
}

/** Pendências exibidas no painel do aluno e no detalhe da solicitação. */
function pendencias(ctx, hoje = new Date().toISOString().slice(0, 10)) {
  const { sol } = ctx;
  const lista = [];
  if (sol.status === 'AGUARDANDO_CORRECAO') lista.push('Solicitação devolvida para correção — veja o motivo no histórico e reenvie.');
  if (['RASCUNHO', 'AGUARDANDO_CORRECAO'].includes(sol.status) && sol.retorno_status !== 'EM_AVALIACAO_FINAL') {
    lista.push(...regraCompletude(ctx));
  }
  for (const r of ctx.relatorios.filter((x) => x.estado_avaliacao === 'DEVOLVIDO')) {
    lista.push(`Relatório ${r.tipo.toLowerCase()} (${r.periodo}) devolvido: ${r.observacao || 'sem observação'}. Envie nova versão.`);
  }
  for (const h of ctx.horas.filter((x) => x.validado === 'RECUSADO')) {
    lista.push(`Registro de horas de ${h.data} recusado: ${h.observacao || 'sem observação'}.`);
  }
  if (sol.status === 'EM_EXECUCAO' && !vazio(ctx.plano.periodo_inicio)) {
    const dias = diasEntre(ctx.plano.periodo_inicio, hoje);
    const venceram = Math.min(Math.floor(dias / SEIS_MESES_DIAS), parciaisExigidos(ctx.plano));
    if (relatoriosValidos(ctx, 'PARCIAL').length < venceram) lista.push('Relatório parcial vencido: envie o relatório periódico (intervalo máximo de seis meses — RN-09).');
    if (!vazio(ctx.plano.periodo_fim) && hoje >= ctx.plano.periodo_fim && !relatoriosValidos(ctx, 'FINAL').length) {
      lista.push('Período do estágio encerrado: envie o relatório final.');
    }
  }
  return [...new Set(lista)];
}

module.exports = {
  vazio,
  diasEntre,
  regraMatricula,
  regraDadosPlano,
  regraDocumentos,
  regraCompletude,
  regraEstagioAnterior,
  regraConferenciaDocumentos,
  regraSeguro,
  regraAssinaturasAnteriores,
  ultimoParecerTecnico,
  parciaisExigidos,
  regraRelatoriosParaAvaliacao,
  regraConclusao,
  horasValidadas,
  pendencias,
};
