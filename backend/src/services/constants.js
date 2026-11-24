const PERFIS = ['ALUNO', 'SECRETARIA', 'PROFESSOR', 'COORDENACAO', 'DIRECAO', 'ADMIN'];

const MODALIDADES = {
  REGULAR: 'Estágio regular',
  EQUIVALENCIA: 'Equivalência (experiência profissional)',
  EQUIPARACAO: 'Equiparação (atividade acadêmica)',
};

const STATUS = {
  RASCUNHO: 'Rascunho',
  ENVIADO: 'Enviado',
  EM_CONFERENCIA: 'Em conferência',
  AGUARDANDO_CORRECAO: 'Aguardando correção',
  REENVIADO: 'Reenviado',
  EM_ANALISE_ACADEMICA: 'Em análise acadêmica',
  AGUARDANDO_ASSINATURA: 'Aguardando assinatura',
  FORMALIZADO: 'Formalizado',
  EM_EXECUCAO: 'Em execução',
  EM_AVALIACAO_FINAL: 'Em avaliação final',
  CONCLUIDO: 'Concluído',
  DEFERIDO: 'Deferido',
  DEFERIDO_PARCIAL: 'Deferido parcialmente',
  INDEFERIDO: 'Indeferido',
  CANCELADO: 'Cancelado',
};

/** Estados finais: nenhuma transição permitida (reabertura somente por fluxo administrativo externo). */
const STATUS_FINAIS = ['CONCLUIDO', 'DEFERIDO', 'DEFERIDO_PARCIAL', 'INDEFERIDO', 'CANCELADO'];

const TIPOS_DOCUMENTO = {
  TCE: 'Termo de Compromisso de Estágio (TCE)',
  PAE: 'Plano de Atividades de Estágio (PAE)',
  COMPROVANTE_MATRICULA: 'Comprovante de matrícula',
  COMPROVANTE_VINCULO: 'Comprovante de vínculo (CTPS, contrato, declaração)',
  DESCRICAO_ATIVIDADES: 'Descrição técnica das atividades',
  RELATORIO_ATIVIDADE: 'Relatório da atividade acadêmica',
  DECLARACAO_ORIENTADOR: 'Declaração do orientador',
  APOLICE_SEGURO: 'Apólice de seguro',
  OUTRO: 'Outro documento',
  RELATORIO_PARCIAL: 'Relatório parcial de estágio',
  RELATORIO_FINAL: 'Relatório final de estágio',
};

/** Tipos de documento que o aluno pode anexar em cada modalidade (RN-15: tipo de documento). */
const DOCUMENTOS_POR_MODALIDADE = {
  REGULAR: ['TCE', 'PAE', 'COMPROVANTE_MATRICULA', 'APOLICE_SEGURO', 'OUTRO'],
  EQUIVALENCIA: ['COMPROVANTE_VINCULO', 'DESCRICAO_ATIVIDADES', 'COMPROVANTE_MATRICULA', 'OUTRO'],
  EQUIPARACAO: ['RELATORIO_ATIVIDADE', 'DECLARACAO_ORIENTADOR', 'COMPROVANTE_MATRICULA', 'OUTRO'],
};

/** Documentos obrigatórios por modalidade (RN-03, RN-11). */
const DOCUMENTOS_OBRIGATORIOS = {
  REGULAR: ['TCE', 'PAE'],
  EQUIVALENCIA: ['COMPROVANTE_VINCULO', 'DESCRICAO_ATIVIDADES'],
  EQUIPARACAO: ['RELATORIO_ATIVIDADE', 'DECLARACAO_ORIENTADOR'],
};

const TIPOS_RELATORIO_DOC = ['RELATORIO_PARCIAL', 'RELATORIO_FINAL'];

const TIPOS_ATIVIDADE_ACADEMICA = {
  INICIACAO_CIENTIFICA: 'Iniciação científica/tecnológica',
  MONITORIA: 'Monitoria',
  PESQUISA: 'Pesquisa',
  EXTENSAO: 'Extensão',
};

const SEGURO = {
  NAO_INFORMADO: 'Não informado',
  CONTRATADO_CONCEDENTE: 'Contratado pela concedente',
  CONTRATADO_INSTITUICAO: 'Contratado pela instituição',
  NAO_APLICAVEL: 'Não aplicável',
};

/** RN-15: formatos aceitos, validados por extensão, MIME e assinatura do arquivo. */
const FORMATOS_ACEITOS = {
  pdf: { mime: 'application/pdf', magic: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  png: { mime: 'image/png', magic: [0x89, 0x50, 0x4e, 0x47] },
  jpg: { mime: 'image/jpeg', magic: [0xff, 0xd8, 0xff] },
  jpeg: { mime: 'image/jpeg', magic: [0xff, 0xd8, 0xff] },
};

module.exports = {
  PERFIS,
  MODALIDADES,
  STATUS,
  STATUS_FINAIS,
  TIPOS_DOCUMENTO,
  DOCUMENTOS_POR_MODALIDADE,
  DOCUMENTOS_OBRIGATORIOS,
  TIPOS_RELATORIO_DOC,
  TIPOS_ATIVIDADE_ACADEMICA,
  SEGURO,
  FORMATOS_ACEITOS,
};
