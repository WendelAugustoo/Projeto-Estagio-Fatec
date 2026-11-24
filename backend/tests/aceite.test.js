/**
 * Testes de aceite (seção 11 da especificação) executados contra a API real,
 * com banco e diretório de uploads temporários.  Rodar: npm test
 */
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'estagios-test-'));
process.env.DB_FILE = path.join(TMP, 'test.db');
process.env.UPLOAD_DIR = path.join(TMP, 'uploads');

const { criarApp } = require('../src/app');
const { getDb, closeDb } = require('../src/db');
const { seedSeVazio, SENHA_PADRAO } = require('../src/db/seed');
const { pdfExemplo } = require('../src/utils/pdfExemplo');

let server;
let base;
const tokens = {};

async function api(quem, metodo, rota, corpo) {
  const headers = { Authorization: `Bearer ${tokens[quem]}` };
  let body;
  if (corpo instanceof FormData) body = corpo;
  else if (corpo !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(corpo);
  }
  const res = await fetch(base + rota, { method: metodo, headers, body });
  const tipo = res.headers.get('content-type') || '';
  return { status: res.status, body: tipo.includes('json') ? await res.json() : await res.arrayBuffer() };
}

async function login(email) {
  const res = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, senha: SENHA_PADRAO }) });
  return (await res.json()).token;
}

function arquivoPdf(nome = 'doc.pdf', conteudo = pdfExemplo(['teste'])) {
  return new Blob([conteudo], { type: nome.endsWith('.pdf') ? 'application/pdf' : 'image/png' });
}

async function anexar(quem, solId, tipo, nome = 'doc.pdf', conteudo) {
  const fd = new FormData();
  fd.append('tipo', tipo);
  fd.append('arquivo', arquivoPdf(nome, conteudo), nome);
  return api(quem, 'POST', `/solicitacoes/${solId}/documentos`, fd);
}

const acao = (quem, id, nome, corpo = {}) => api(quem, 'POST', `/solicitacoes/${id}/acoes/${nome}`, corpo);
const solicitacaoDoAluno = (email, status) =>
  getDb()
    .prepare('SELECT s.id FROM solicitacao s JOIN aluno a ON a.id = s.aluno_id JOIN usuario u ON u.id = a.usuario_id WHERE u.email = ? AND s.status = ?')
    .get(email, status).id;

before(async () => {
  seedSeVazio();
  server = criarApp().listen(0);
  base = `http://127.0.0.1:${server.address().port}/api`;
  for (const [k, email] of Object.entries({
    ana: 'aluno@fatec.demo',
    bruno: 'aluno.irregular@fatec.demo',
    carla: 'aluno2@fatec.demo',
    diego: 'aluno3@fatec.demo',
    elisa: 'aluno4@fatec.demo',
    sec: 'secretaria@fatec.demo',
    prof: 'professor@fatec.demo',
    prof2: 'professora2@fatec.demo',
    coord: 'coordenacao@fatec.demo',
    dir: 'direcao@fatec.demo',
    admin: 'admin@fatec.demo',
  })) {
    tokens[k] = await login(email);
  }
});

after(() => {
  server.close();
  closeDb();
  fs.rmSync(TMP, { recursive: true, force: true });
});

describe('Autenticação e perfis (RF-01)', () => {
  test('login inválido retorna mensagem genérica', async () => {
    const res = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'aluno@fatec.demo', senha: 'errada' }) });
    assert.equal(res.status, 401);
    assert.equal((await res.json()).error.message, 'E-mail ou senha inválidos.');
  });
  test('rota sem token é recusada', async () => {
    const res = await fetch(base + '/solicitacoes');
    assert.equal(res.status, 401);
  });
  test('aluno não acessa cadastro de usuários', async () => {
    assert.equal((await api('ana', 'GET', '/usuarios')).status, 403);
  });
});

describe('Critérios de aceite', () => {
  test('CA-01: matrícula irregular bloqueia envio de estágio regular', async () => {
    const id = solicitacaoDoAluno('aluno.irregular@fatec.demo', 'RASCUNHO');
    const r = await api('bruno', 'POST', `/solicitacoes/${id}/enviar`, {});
    assert.equal(r.status, 422);
    assert.ok(r.body.error.details.some((d) => d.includes('IRREGULAR')), JSON.stringify(r.body));
  });

  // Fluxo completo da Ana usado pelos cenários CA-02..CA-06 e CA-11
  let solAna;
  test('CA-02: TCE sem PAE não pode ser enviado', async () => {
    const conc = (await api('ana', 'GET', '/concedentes')).body[0].id;
    const r = await api('ana', 'POST', '/solicitacoes', {
      modalidade: 'REGULAR',
      concedente_id: conc,
      plano: { descricao: 'Desenvolvimento web', tecnicas: 'React, Node', compatibilidade: 'Compatível com DSM', periodo_inicio: '2027-02-01', periodo_fim: '2027-07-31', horas_previstas: 240 },
    });
    assert.equal(r.status, 201);
    solAna = r.body.id;
    assert.equal((await anexar('ana', solAna, 'TCE')).status, 201);
    const envio = await api('ana', 'POST', `/solicitacoes/${solAna}/enviar`, {});
    assert.equal(envio.status, 422);
    assert.ok(envio.body.error.details.some((d) => d.includes('Plano de Atividades')));
    const det = await api('ana', 'GET', `/solicitacoes/${solAna}`);
    assert.equal(det.body.solicitacao.status, 'RASCUNHO');
  });

  test('RN-15: upload com conteúdo falso ou tipo inválido é recusado', async () => {
    const falso = await anexar('ana', solAna, 'PAE', 'falso.pdf', Buffer.from('nao sou um pdf'));
    assert.equal(falso.status, 400);
    const exe = await anexar('ana', solAna, 'PAE', 'virus.exe');
    assert.equal(exe.status, 400);
    const tipoErrado = await anexar('ana', solAna, 'DECLARACAO_ORIENTADOR');
    assert.equal(tipoErrado.status, 400);
  });

  test('CA-03: Secretaria aponta falta de assinatura → Aguardando correção com motivo', async () => {
    assert.equal((await anexar('ana', solAna, 'PAE')).status, 201);
    assert.equal((await api('ana', 'POST', `/solicitacoes/${solAna}/enviar`, {})).status, 200);
    assert.equal((await acao('sec', solAna, 'iniciar_conferencia')).status, 200);
    const tce = (await api('sec', 'GET', `/solicitacoes/${solAna}`)).body.documentos.find((d) => d.tipo === 'TCE');
    const rej = await api('sec', 'PATCH', `/documentos/${tce.id}/conferencia`, { status: 'REJEITADO', observacao: 'TCE sem assinatura da concedente' });
    assert.equal(rej.status, 200);
    const semMotivo = await api('sec', 'POST', `/solicitacoes/${solAna}/devolver`, {});
    assert.equal(semMotivo.status, 400);
    const dev = await api('sec', 'POST', `/solicitacoes/${solAna}/devolver`, { motivo: 'Falta assinatura da concedente no TCE.' });
    assert.equal(dev.status, 200);
    const det = await api('ana', 'GET', `/solicitacoes/${solAna}`);
    assert.equal(det.body.solicitacao.status, 'AGUARDANDO_CORRECAO');
    assert.equal(det.body.historico.at(-1).motivo, 'Falta assinatura da concedente no TCE.');
  });

  test('CA-04: reenvio armazena nova versão e preserva a anterior', async () => {
    const bloqueado = await acao('ana', solAna, 'reenviar');
    assert.equal(bloqueado.status, 422, 'não reenvia com documento rejeitado');
    assert.equal((await anexar('ana', solAna, 'TCE')).status, 201);
    assert.equal((await acao('ana', solAna, 'reenviar')).status, 200);
    const docs = (await api('sec', 'GET', `/solicitacoes/${solAna}`)).body.documentos.filter((d) => d.tipo === 'TCE');
    assert.equal(docs.length, 2);
    assert.deepEqual(docs.map((d) => [d.versao, d.status]), [[2, 'PENDENTE'], [1, 'SUBSTITUIDO']]);
  });

  test('CA-06: Direção não conclui antes da análise (backend recusa)', async () => {
    const r = await acao('dir', solAna, 'assinar');
    assert.equal(r.status, 422);
  });

  test('CA-05: professor identifica PAE incompatível → retorna com justificativa', async () => {
    assert.equal((await acao('sec', solAna, 'retomar')).status, 200);
    const docs = (await api('sec', 'GET', `/solicitacoes/${solAna}`)).body.documentos.filter((d) => d.status === 'PENDENTE');
    for (const d of docs) assert.equal((await api('sec', 'PATCH', `/documentos/${d.id}/conferencia`, { status: 'CONFERIDO' })).status, 200);
    const profId = getDb().prepare("SELECT id FROM usuario WHERE email = 'professor@fatec.demo'").get().id;
    const semSeguro = await acao('sec', solAna, 'encaminhar_analise', { professor_id: profId });
    assert.equal(semSeguro.status, 422, 'RN-08 exige seguro registrado');
    await api('sec', 'PATCH', `/solicitacoes/${solAna}/conferencia`, { seguro_situacao: 'CONTRATADO_CONCEDENTE', seguro_responsavel: 'Empresa X', ass_aluno: true, ass_concedente: true });
    assert.equal((await acao('sec', solAna, 'encaminhar_analise', { professor_id: profId })).status, 200);

    const outroProf = await api('prof2', 'GET', `/solicitacoes/${solAna}`);
    assert.equal(outroProf.status, 404, 'professor não designado não acessa');

    const dev = await api('prof', 'POST', `/solicitacoes/${solAna}/devolver`, { motivo: 'Atividades do PAE não descrevem técnicas compatíveis com o curso.' });
    assert.equal(dev.status, 200);
    const det = await api('ana', 'GET', `/solicitacoes/${solAna}`);
    assert.equal(det.body.solicitacao.status, 'AGUARDANDO_CORRECAO');
    const p = det.body.pareceres.at(-1);
    assert.equal(p.tipo, 'TECNICO');
    assert.equal(p.resultado, 'AJUSTES_NECESSARIOS');
  });

  test('Fluxo regular completo até Formalizado e Em execução (RN-07)', async () => {
    await api('ana', 'PUT', `/solicitacoes/${solAna}`, {
      concedente_id: (await api('ana', 'GET', '/concedentes')).body[0].id,
      plano: { descricao: 'Desenvolvimento web full stack', tecnicas: 'React, Node.js, SQL, testes', compatibilidade: 'Disciplinas de Web e BD', periodo_inicio: '2027-02-01', periodo_fim: '2027-07-31', horas_previstas: 240 },
    });
    assert.equal((await acao('ana', solAna, 'reenviar')).status, 200);
    assert.equal((await acao('sec', solAna, 'retomar')).status, 200);
    assert.equal((await acao('sec', solAna, 'encaminhar_analise')).status, 200);
    const semParecer = await acao('coord', solAna, 'aprovar_plano', { motivo: 'ok' });
    assert.equal(semParecer.status, 422, 'coordenação aguarda parecer técnico');
    assert.equal((await api('prof', 'POST', `/solicitacoes/${solAna}/pareceres`, { resultado: 'FAVORAVEL', motivo: 'PAE adequado.' })).status, 201);
    assert.equal((await acao('coord', solAna, 'aprovar_plano', { motivo: 'Compatível com o PPC.' })).status, 200);
    assert.equal((await acao('dir', solAna, 'assinar')).status, 200);
    assert.equal((await acao('sec', solAna, 'liberar')).status, 200);
    assert.equal((await api('ana', 'GET', `/solicitacoes/${solAna}`)).body.solicitacao.status, 'EM_EXECUCAO');
  });

  test('RN-07: Direção não assina sem assinaturas anteriores', async () => {
    const id = solicitacaoDoAluno('aluno7@fatec.demo', 'AGUARDANDO_ASSINATURA');
    getDb().prepare('UPDATE solicitacao SET ass_concedente = 0 WHERE id = ?').run(id);
    const r = await acao('dir', id, 'assinar');
    assert.equal(r.status, 422);
    getDb().prepare('UPDATE solicitacao SET ass_concedente = 1 WHERE id = ?').run(id);
    assert.equal((await acao('dir', id, 'assinar')).status, 200);
  });

  test('RN-10: novo estágio regular bloqueado com outro em andamento', async () => {
    const conc = (await api('ana', 'GET', '/concedentes')).body[0].id;
    const r = await api('ana', 'POST', '/solicitacoes', {
      modalidade: 'REGULAR', concedente_id: conc,
      plano: { descricao: 'x', tecnicas: 'y', compatibilidade: 'z', periodo_inicio: '2027-08-01', periodo_fim: '2027-12-01', horas_previstas: 100 },
    });
    await anexar('ana', r.body.id, 'TCE');
    await anexar('ana', r.body.id, 'PAE');
    const envio = await api('ana', 'POST', `/solicitacoes/${r.body.id}/enviar`, {});
    assert.equal(envio.status, 422);
    assert.ok(envio.body.error.details.some((d) => d.includes('RN-10')));
  });

  test('CA-07: equiparação sem previsão no PPC não pode ser deferida', async () => {
    const id = solicitacaoDoAluno('aluno2@fatec.demo', 'EM_ANALISE_ACADEMICA');
    const r = await api('coord', 'POST', `/solicitacoes/${id}/pareceres`, { resultado: 'DEFERIDO', motivo: 'ok' });
    assert.equal(r.status, 422);
    assert.ok(r.body.error.details.some((d) => d.includes('RN-12')));
    assert.equal((await api('carla', 'GET', `/solicitacoes/${id}`)).body.solicitacao.status, 'EM_ANALISE_ACADEMICA');
  });

  test('CA-08: Coordenação aprova reconhecimento parcial com horas e justificativa', async () => {
    // Equiparação de aluna de DSM (curso permite equiparação)
    const conc = null;
    void conc;
    const r = await api('ana', 'POST', '/solicitacoes', {
      modalidade: 'EQUIPARACAO', tipo_atividade: 'INICIACAO_CIENTIFICA', orientador_nome: 'Prof. Carlos Andrade',
      plano: { descricao: 'Iniciação científica em visão computacional', periodo_inicio: '2026-01-10', periodo_fim: '2026-10-10', horas_previstas: 200 },
    });
    const id = r.body.id;
    await anexar('ana', id, 'RELATORIO_ATIVIDADE');
    await anexar('ana', id, 'DECLARACAO_ORIENTADOR');
    assert.equal((await api('ana', 'POST', `/solicitacoes/${id}/enviar`, {})).status, 200);
    await acao('sec', id, 'iniciar_conferencia');
    for (const d of (await api('sec', 'GET', `/solicitacoes/${id}`)).body.documentos) await api('sec', 'PATCH', `/documentos/${d.id}/conferencia`, { status: 'CONFERIDO' });
    const profId = getDb().prepare("SELECT id FROM usuario WHERE email = 'professor@fatec.demo'").get().id;
    assert.equal((await acao('sec', id, 'encaminhar_analise', { professor_id: profId })).status, 200);
    await api('prof', 'POST', `/solicitacoes/${id}/pareceres`, { resultado: 'FAVORAVEL', horas_sugeridas: 150, motivo: 'Parte das horas comprovadas.' });
    const invalido = await api('coord', 'POST', `/solicitacoes/${id}/pareceres`, { resultado: 'DEFERIDO_PARCIAL', horas_reconhecidas: 250, motivo: 'x' });
    assert.equal(invalido.status, 422);
    const semJust = await api('coord', 'POST', `/solicitacoes/${id}/pareceres`, { resultado: 'DEFERIDO_PARCIAL', horas_reconhecidas: 150 });
    assert.equal(semJust.status, 400);
    const ok = await api('coord', 'POST', `/solicitacoes/${id}/pareceres`, { resultado: 'DEFERIDO_PARCIAL', horas_reconhecidas: 150, motivo: '150h comprovadas pelo relatório.' });
    assert.equal(ok.status, 201);
    const det = (await api('ana', 'GET', `/solicitacoes/${id}`)).body;
    assert.equal(det.solicitacao.status, 'DEFERIDO_PARCIAL');
    assert.equal(det.solicitacao.horas_reconhecidas, 150);
    assert.equal(det.pareceres.at(-1).justificativa, '150h comprovadas pelo relatório.');
  });

  test('CA-09: aluno não acessa processo de outro aluno', async () => {
    const id = solicitacaoDoAluno('aluno3@fatec.demo', 'EM_EXECUCAO');
    assert.equal((await api('ana', 'GET', `/solicitacoes/${id}`)).status, 404);
    assert.equal((await api('ana', 'GET', `/solicitacoes/${id}/pdf`)).status, 404);
    const docId = getDb().prepare('SELECT id FROM documento WHERE solicitacao_id = ?').get(id).id;
    assert.equal((await api('ana', 'GET', `/documentos/${docId}/download`)).status, 404);
    assert.equal((await api('ana', 'POST', `/solicitacoes/${id}/horas`, { data: '2026-10-01', horas: 4, descricao: 'x' })).status, 404);
    const lista = (await api('ana', 'GET', '/solicitacoes')).body;
    assert.ok(lista.every((s) => s.aluno_nome === 'Ana Lima'));
  });

  test('CA-10: relatório final devolvido → pendência no painel e conclusão bloqueada', async () => {
    const id = solicitacaoDoAluno('aluno4@fatec.demo', 'EM_AVALIACAO_FINAL');
    const rel = (await api('prof', 'GET', `/solicitacoes/${id}`)).body.relatorios.find((r) => r.tipo === 'FINAL');
    const dev = await api('prof', 'PATCH', `/relatorios/${rel.id}/avaliacao`, { estado: 'DEVOLVIDO', observacao: 'Faltam evidências das atividades.' });
    assert.equal(dev.status, 200);
    const det = (await api('elisa', 'GET', `/solicitacoes/${id}`)).body;
    assert.equal(det.solicitacao.status, 'AGUARDANDO_CORRECAO');
    assert.ok(det.pendencias.some((p) => p.includes('devolvido')));
    const painel = (await api('elisa', 'GET', '/dashboard')).body;
    assert.ok(painel.pendencias.some((p) => p.id === id));
    assert.equal((await acao('sec', id, 'concluir')).status, 422);

    // correção: novo relatório final → reenviar → professor aprova → Secretaria encerra
    const fd = new FormData();
    fd.append('tipo', 'FINAL');
    fd.append('periodo', 'Período completo (v2)');
    fd.append('arquivo', arquivoPdf(), 'final.pdf');
    assert.equal((await api('elisa', 'POST', `/solicitacoes/${id}/relatorios`, fd)).status, 201);
    assert.equal((await acao('elisa', id, 'reenviar')).status, 200);
    assert.equal((await acao('prof', id, 'retomar')).status, 200);
    const novo = (await api('prof', 'GET', `/solicitacoes/${id}`)).body.relatorios.find((r) => r.tipo === 'FINAL' && r.estado_avaliacao === 'PENDENTE');
    assert.equal((await api('prof', 'PATCH', `/relatorios/${novo.id}/avaliacao`, { estado: 'APROVADO' })).status, 200);
    assert.equal((await acao('sec', id, 'concluir')).status, 200);
    const fim = (await api('elisa', 'GET', `/solicitacoes/${id}`)).body.solicitacao;
    assert.equal(fim.status, 'CONCLUIDO');
    assert.equal(fim.horas_reconhecidas, 240);
  });

  test('CA-11: histórico exibe ator, data, motivo e transição', async () => {
    const hist = (await api('ana', 'GET', `/solicitacoes/${solAna}/historico`)).body;
    const dev = hist.find((h) => h.acao === 'devolver');
    assert.ok(dev.autor_nome && dev.data_hora && dev.motivo);
    assert.equal(dev.status_anterior, 'EM_CONFERENCIA');
    assert.equal(dev.status_novo, 'AGUARDANDO_CORRECAO');
    const audit = (await api('admin', 'GET', `/auditoria?entidade=solicitacao&entidade_id=${solAna}`)).body;
    assert.ok(audit.some((a) => a.acao === 'DOCUMENTO_CONFERIDO'));
  });

  test('CA-12 (backend): listagem e dashboard respondem para todos os perfis', async () => {
    for (const quem of ['ana', 'sec', 'prof', 'coord', 'dir', 'admin']) {
      assert.equal((await api(quem, 'GET', '/dashboard')).status, 200, quem);
      assert.equal((await api(quem, 'GET', '/solicitacoes')).status, 200, quem);
    }
  });
});

describe('Execução, horas e relatórios (RF-08, RN-09)', () => {
  test('aluno registra horas; professor valida; avaliação final exige relatório final', async () => {
    const id = solicitacaoDoAluno('aluno3@fatec.demo', 'EM_EXECUCAO');
    const hoje = new Date().toISOString().slice(0, 10);
    assert.equal((await api('diego', 'POST', `/solicitacoes/${id}/horas`, { data: hoje, horas: 4, descricao: 'Revisão de código' })).status, 201);
    assert.equal((await api('diego', 'POST', `/solicitacoes/${id}/horas`, { data: '2099-01-01', horas: 4, descricao: 'futuro' })).status, 422);
    assert.equal((await api('diego', 'POST', `/solicitacoes/${id}/horas`, { data: hoje, horas: 20, descricao: 'demais' })).status, 400);
    const h = (await api('prof', 'GET', `/solicitacoes/${id}`)).body.horas.find((x) => x.validado === 'PENDENTE');
    assert.equal((await api('prof', 'PATCH', `/horas/${h.id}/validacao`, { validado: 'RECUSADO' })).status, 400, 'recusa exige motivo');
    assert.equal((await api('prof', 'PATCH', `/horas/${h.id}/validacao`, { validado: 'VALIDADO' })).status, 200);
    assert.equal((await api('diego', 'PATCH', `/horas/${h.id}/validacao`, { validado: 'VALIDADO' })).status, 403);
    const r = await acao('diego', id, 'solicitar_avaliacao_final');
    assert.equal(r.status, 422);
    assert.ok(r.body.error.details.some((d) => d.includes('relatório final')));
  });

  test('PDF do resumo é gerado (RF-11)', async () => {
    const id = solicitacaoDoAluno('aluno3@fatec.demo', 'EM_EXECUCAO');
    const r = await api('diego', 'GET', `/solicitacoes/${id}/pdf`);
    assert.equal(r.status, 200);
    assert.equal(Buffer.from(r.body).subarray(0, 4).toString(), '%PDF');
  });

  test('Admin não pode emitir parecer (sem permissão para alterar pareceres)', async () => {
    const id = solicitacaoDoAluno('aluno2@fatec.demo', 'EM_ANALISE_ACADEMICA');
    const r = await api('admin', 'POST', `/solicitacoes/${id}/pareceres`, { resultado: 'FAVORAVEL', motivo: 'x' });
    assert.equal(r.status, 403);
  });
});
