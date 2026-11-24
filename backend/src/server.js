const { PORT } = require('./config');
const { getDb } = require('./db');
const { criarApp } = require('./app');
const { seedSeVazio } = require('./db/seed');

getDb();
seedSeVazio();

criarApp().listen(PORT, () => {
  console.log(`API de Gestão de Estágios em http://localhost:${PORT}/api`);
});
