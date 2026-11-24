const TZ = 'America/Sao_Paulo';

export const fmtDataHora = (iso) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: TZ, dateStyle: 'short', timeStyle: 'short' }) : '—';

export const fmtDia = (d) => (d ? d.split('-').reverse().join('/') : '—');

export const fmtBytes = (n) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

export const PERFIL_ROTULO = {
  ALUNO: 'Aluno',
  SECRETARIA: 'Secretaria / Setor de Estágios',
  PROFESSOR: 'Professor responsável',
  COORDENACAO: 'Coordenação',
  DIRECAO: 'Direção',
  ADMIN: 'Administrador técnico',
};

/** Cor do selo de status. */
export function corStatus(status) {
  if (['CONCLUIDO', 'DEFERIDO', 'FORMALIZADO'].includes(status)) return 'verde';
  if (['DEFERIDO_PARCIAL', 'EM_EXECUCAO'].includes(status)) return 'azul';
  if (['INDEFERIDO', 'CANCELADO'].includes(status)) return 'cinza-escuro';
  if (status === 'AGUARDANDO_CORRECAO') return 'laranja';
  if (status === 'RASCUNHO') return 'cinza';
  return 'roxo';
}

export const RESULTADO_ROTULO = {
  FAVORAVEL: 'Favorável',
  DESFAVORAVEL: 'Desfavorável',
  AJUSTES_NECESSARIOS: 'Ajustes necessários',
  APROVADO: 'Aprovado',
  DEFERIDO: 'Deferido integralmente',
  DEFERIDO_PARCIAL: 'Deferido parcialmente',
  INDEFERIDO: 'Indeferido',
  RELATORIO_FINAL_APROVADO: 'Relatório final aprovado',
  RELATORIO_FINAL_DEVOLVIDO: 'Relatório final devolvido',
};

export const TIPO_PARECER_ROTULO = { TECNICO: 'Parecer técnico', ACADEMICO: 'Parecer acadêmico', FINAL: 'Avaliação final' };
