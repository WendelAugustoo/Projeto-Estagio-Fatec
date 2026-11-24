// Instala as dependências do backend e do frontend após o `npm install` da raiz.
// Roda `npm install` dentro de cada pasta (cwd), evitando que o npm reexecute
// o postinstall da raiz em loop.
const { spawnSync } = require('node:child_process');
const path = require('node:path');

for (const pasta of ['backend', 'frontend']) {
  console.log(`\n> Instalando dependências de ${pasta}...`);
  const r = spawnSync('npm', ['install'], {
    cwd: path.join(__dirname, '..', pasta),
    stdio: 'inherit',
    shell: true,
  });
  if (r.status !== 0) {
    console.error(`Falha ao instalar dependências de ${pasta}.`);
    process.exit(r.status || 1);
  }
}
