const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const multer = require('multer');
const { UPLOAD_DIR, MAX_UPLOAD_MB } = require('../config');
const { FORMATOS_ACEITOS } = require('../services/constants');
const { badRequest } = require('../utils/errors');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/**
 * RN-15: o arquivo é salvo com nome aleatório (nunca o nome original) em diretório
 * privado, fora de qualquer pasta servida estaticamente.
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, crypto.randomUUID() + '.bin'),
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).slice(1).toLowerCase();
    const formato = FORMATOS_ACEITOS[ext];
    if (!formato || formato.mime !== file.mimetype) {
      return cb(badRequest('Formato não aceito. Envie arquivos PDF, PNG ou JPG.'));
    }
    cb(null, true);
  },
});

/** Confere a assinatura binária (magic bytes) para impedir arquivos renomeados. */
function validarConteudo(file) {
  const ext = path.extname(file.originalname).slice(1).toLowerCase();
  const { magic } = FORMATOS_ACEITOS[ext];
  const fd = fs.openSync(file.path, 'r');
  const buf = Buffer.alloc(magic.length);
  fs.readSync(fd, buf, 0, magic.length, 0);
  fs.closeSync(fd);
  if (!magic.every((b, i) => buf[i] === b)) {
    fs.rmSync(file.path, { force: true });
    throw badRequest('O conteúdo do arquivo não corresponde à extensão informada.');
  }
}

/** Middleware que trata erros do multer com mensagens amigáveis. */
function receberArquivo(campo) {
  const handler = upload.single(campo);
  return (req, res, next) =>
    handler(req, res, (err) => {
      if (err?.code === 'LIMIT_FILE_SIZE') return next(badRequest(`Arquivo excede o limite de ${MAX_UPLOAD_MB} MB.`));
      if (err) return next(err.status ? err : badRequest(err.message));
      if (!req.file) return next(badRequest('Nenhum arquivo enviado.'));
      try {
        validarConteudo(req.file);
        next();
      } catch (e) {
        next(e);
      }
    });
}

module.exports = { receberArquivo };
