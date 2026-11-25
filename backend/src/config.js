const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

module.exports = {
  // API_PORT (e não PORT) para não colidir com a porta do frontend em ferramentas que definem PORT.
  PORT: Number(process.env.API_PORT || 3000),
  // Em produção, defina JWT_SECRET por variável de ambiente.
  JWT_SECRET: process.env.JWT_SECRET || 'troque-este-segredo-em-producao',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
  DB_FILE: process.env.DB_FILE || path.join(ROOT, 'data', 'estagios.db'),
  UPLOAD_DIR: process.env.UPLOAD_DIR || path.join(ROOT, 'uploads'),
  MAX_UPLOAD_MB: Number(process.env.MAX_UPLOAD_MB || 5),
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  // Prazos (valores de demonstração — não são normas oficiais da CESU/Fatec).
  // Dias que o aluno tem para corrigir uma solicitação devolvida.
  PRAZO_CORRECAO_DIAS: Number(process.env.PRAZO_CORRECAO_DIAS || 15),
  // Antecedência mínima (em dias) entre o envio/formalização e o início do estágio regular.
  ANTECEDENCIA_MINIMA_DIAS: Number(process.env.ANTECEDENCIA_MINIMA_DIAS || 0),
};
