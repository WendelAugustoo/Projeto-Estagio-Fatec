/** RF-11: resumo/comprovante da solicitação em PDF (sem valor oficial). */
const PDFDocument = require('pdfkit');
const { getDb } = require('../db');
const C = require('./constants');
const R = require('./regras');

const fmtData = (iso) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }) : '—';
const fmtDia = (d) => (d ? d.split('-').reverse().join('/') : '—');

function gerarPdf(ctx, usuario, stream) {
  const { sol, plano } = ctx;
  const historico = getDb()
    .prepare('SELECT h.*, u.nome AS autor_nome FROM historico_status h JOIN usuario u ON u.id = h.autor_id WHERE h.solicitacao_id = ? ORDER BY h.id')
    .all(sol.id);

  const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `Solicitação ${sol.protocolo || sol.id}` } });
  doc.pipe(stream);

  const titulo = (t) => {
    doc.moveDown(0.8).fontSize(12).fillColor('#14213d').font('Helvetica-Bold').text(t);
    doc.moveTo(50, doc.y + 2).lineTo(545, doc.y + 2).strokeColor('#cbd5e1').stroke();
    doc.moveDown(0.4).font('Helvetica').fontSize(10).fillColor('#111');
  };
  const campo = (rotulo, valor) => {
    doc.font('Helvetica-Bold').text(`${rotulo}: `, { continued: true }).font('Helvetica').text(valor ?? '—');
  };

  doc.fontSize(9).fillColor('#64748b').text('Sistema de Gestão de Estágios Supervisionados — projeto acadêmico demonstrativo', { align: 'center' });
  doc.moveDown(0.5).fontSize(16).fillColor('#14213d').font('Helvetica-Bold').text('Resumo da solicitação', { align: 'center' });
  doc.fontSize(11).font('Helvetica').fillColor('#111').text(`Protocolo interno: ${sol.protocolo || 'não enviado (rascunho)'}`, { align: 'center' });

  titulo('Identificação');
  campo('Aluno', `${sol.aluno_nome} — matrícula ${sol.matricula}`);
  campo('Curso', sol.curso_nome);
  campo('Modalidade', C.MODALIDADES[sol.modalidade]);
  campo('Situação atual', C.STATUS[sol.status]);
  if (sol.concedente_nome) campo('Concedente', `${sol.concedente_nome} (${sol.concedente_identificador})`);
  if (sol.empresa_vinculo) campo('Empresa / vínculo', sol.empresa_vinculo);
  if (sol.tipo_atividade) campo('Atividade acadêmica', C.TIPOS_ATIVIDADE_ACADEMICA[sol.tipo_atividade]);
  if (sol.orientador_nome) campo('Orientador', sol.orientador_nome);
  campo('Professor responsável', sol.professor_nome || 'não designado');
  campo('Criada em', fmtData(sol.criada_em));
  campo('Enviada em', fmtData(sol.enviada_em));

  titulo(sol.modalidade === 'REGULAR' ? 'Plano de Atividades (PAE)' : 'Atividades e carga horária');
  campo('Período', `${fmtDia(plano.periodo_inicio)} a ${fmtDia(plano.periodo_fim)}`);
  campo('Carga horária', plano.horas_previstas ? `${plano.horas_previstas} h` : '—');
  campo('Descrição', plano.descricao);
  if (plano.tecnicas) campo('Técnicas', plano.tecnicas);
  if (plano.compatibilidade) campo('Compatibilidade com o curso', plano.compatibilidade);
  if (sol.horas_reconhecidas !== null && sol.horas_reconhecidas !== undefined) campo('Horas reconhecidas', `${sol.horas_reconhecidas} h`);

  if (sol.modalidade === 'REGULAR') {
    titulo('Formalização (registro acadêmico — sem valor de assinatura oficial)');
    campo('Seguro', `${C.SEGURO[sol.seguro_situacao]}${sol.seguro_responsavel ? ' — responsável: ' + sol.seguro_responsavel : ''}`);
    campo('Assinaturas registradas', [
      `Aluno ${sol.ass_aluno ? '✓' : '✗'}`,
      `Concedente ${sol.ass_concedente ? '✓' : '✗'}`,
      `Coordenação ${sol.ass_coordenacao ? '✓' : '✗'}`,
      `Direção ${sol.ass_direcao ? '✓' : '✗'}`,
    ].join('   ').replace(/✓/g, 'sim').replace(/✗/g, 'não'));
    campo('Horas', `registradas ${ctx.horas.reduce((s, h) => s + Number(h.horas), 0)} h / validadas ${R.horasValidadas(ctx)} h`);
  }

  titulo('Documentos vigentes');
  const vigentes = ctx.documentos.filter((d) => d.status !== 'SUBSTITUIDO');
  if (!vigentes.length) doc.text('Nenhum documento anexado.');
  for (const d of vigentes) doc.text(`• ${C.TIPOS_DOCUMENTO[d.tipo]} — v${d.versao} — ${d.status} — ${fmtData(d.data_envio)}`);

  titulo('Pareceres');
  if (!ctx.pareceres.length) doc.text('Nenhum parecer registrado.');
  for (const p of ctx.pareceres) {
    doc.font('Helvetica-Bold').text(`${fmtData(p.data)} — ${p.tipo} — ${p.resultado} — ${p.avaliador_nome}`);
    doc.font('Helvetica').text(p.justificativa, { indent: 10 });
  }

  titulo('Histórico de status');
  for (const h of historico) {
    doc.text(`${fmtData(h.data_hora)} — ${h.status_anterior ? C.STATUS[h.status_anterior] + ' → ' : ''}${C.STATUS[h.status_novo]} — ${h.autor_nome}${h.motivo ? ' — ' + h.motivo : ''}`);
  }

  doc.moveDown(1.5).fontSize(8).fillColor('#64748b').text(
    `Gerado em ${fmtData(new Date().toISOString())} por ${usuario.nome}. Documento demonstrativo de projeto acadêmico: não substitui SEI, assinatura eletrônica oficial ou deliberação da CESU/Fatec (RN-16).`,
    { align: 'center' }
  );
  doc.end();
}

module.exports = { gerarPdf };
