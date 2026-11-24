class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const badRequest = (message, details) => new AppError(400, 'VALIDATION_ERROR', message, details);
const unauthorized = (message = 'Sessão ausente ou expirada.') => new AppError(401, 'UNAUTHENTICATED', message);
const forbidden = (message = 'Você não tem permissão para esta ação.') => new AppError(403, 'FORBIDDEN', message);
const notFound = (message = 'Registro não encontrado.') => new AppError(404, 'NOT_FOUND', message);
const conflict = (message, details) => new AppError(409, 'CONFLICT', message, details);
/** Violação de regra de negócio (transição bloqueada, documento faltante etc.). */
const businessRule = (message, details) => new AppError(422, 'BUSINESS_RULE', message, details);

module.exports = { AppError, badRequest, unauthorized, forbidden, notFound, conflict, businessRule };
