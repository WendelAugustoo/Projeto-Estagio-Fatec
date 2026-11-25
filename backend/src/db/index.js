const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { DB_FILE } = require('../config');

let db;

function getDb() {
  if (db) return db;
  if (DB_FILE !== ':memory:') fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  db = new DatabaseSync(DB_FILE);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  migrar(db);
  return db;
}

/** Migrações simples para bancos criados por versões anteriores (sem precisar recriar). */
function migrar(conn) {
  const colunas = conn.prepare('PRAGMA table_info(solicitacao)').all().map((c) => c.name);
  if (!colunas.includes('prazo_correcao')) {
    conn.exec('ALTER TABLE solicitacao ADD COLUMN prazo_correcao TEXT');
  }
}

/** Executa fn dentro de uma transação (RNF-05). Reverte em caso de erro. */
function transaction(fn) {
  const conn = getDb();
  conn.exec('BEGIN IMMEDIATE');
  try {
    const result = fn(conn);
    conn.exec('COMMIT');
    return result;
  } catch (err) {
    conn.exec('ROLLBACK');
    throw err;
  }
}

function closeDb() {
  if (db) {
    db.close();
    db = undefined;
  }
}

module.exports = { getDb, transaction, closeDb };
