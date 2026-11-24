/**
 * Dados de demonstração 100% fictícios.
 *   npm run seed  → apaga o banco e os uploads e recria tudo
 * Ao iniciar o servidor, o seed roda automaticamente se o banco estiver vazio.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { DB_FILE, UPLOAD_DIR } = require('../config');
const { getDb, closeDb, transaction } = require('./index');
const { pdfExemplo } = require('../utils/pdfExemplo');

const SENHA_PADRAO = 'Senha@123';

const DIA = 24 * 60 * 60 * 1000;
const hoje = new Date();
const diaRel = (d) => new Date(hoje.getTime() + d * DIA).toISOString().slice(0, 10);
const tsRel = (d, h = 10) => {
  const t = new Date(hoje.getTime() + d * DIA);
  t.setUTCHours(h + 3, 0, 0, 0); // h horário de Brasília
  return t.toISOString();
};

function seed(db) {
  const hash = bcrypt.hashSync(SENHA_PADRAO, 10);
  const ins = (sql, ...p) => Number(db.prepare(sql).run(...p).lastInsertRowid);

  /* ---------------- cursos ---------------- */
  const cDSM = ins("INSERT INTO curso (nome, carga_horaria_estagio, permite_equiparacao) VALUES ('Desenvolvimento de Software Multiplataforma', 240, 1)");
  const cADS = ins("INSERT INTO curso (nome, carga_horaria_estagio, permite_equiparacao) VALUES ('Análise e Desenvolvimento de Sistemas', 240, 0)");
  const cGE = ins("INSERT INTO curso (nome, carga_horaria_estagio, permite_equiparacao) VALUES ('Gestão Empresarial', 240, 0)");

  /* ---------------- usuários ---------------- */
  const usuario = (nome, email, perfil) => ins('INSERT INTO usuario (nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?)', nome, email, hash, perfil);
  const admin = usuario('Administrador Técnico', 'admin@fatec.demo', 'ADMIN');
  const secretaria = usuario('Marina Teles (Secretaria)', 'secretaria@fatec.demo', 'SECRETARIA');
  const prof = usuario('Prof. Carlos Andrade', 'professor@fatec.demo', 'PROFESSOR');
  const prof2 = usuario('Profa. Helena Souza', 'professora2@fatec.demo', 'PROFESSOR');
  const coord = usuario('Profa. Renata Lopes (Coordenação)', 'coordenacao@fatec.demo', 'COORDENACAO');
  const direcao = usuario('Dr. Paulo Mendes (Direção)', 'direcao@fatec.demo', 'DIRECAO');

  const aluno = (nome, email, matricula, curso, situacao = 'REGULAR') => {
    const uid = usuario(nome, email, 'ALUNO');
    return { uid, id: ins('INSERT INTO aluno (usuario_id, matricula, curso_id, situacao_matricula) VALUES (?, ?, ?, ?)', uid, matricula, curso, situacao) };
  };
  const ana = aluno('Ana Lima', 'aluno@fatec.demo', '2024100001', cDSM);
  const bruno = aluno('Bruno Costa', 'aluno.irregular@fatec.demo', '2024100002', cDSM, 'IRREGULAR');
  const carla = aluno('Carla Mendes', 'aluno2@fatec.demo', '2023200003', cADS);
  const diego = aluno('Diego Rocha', 'aluno3@fatec.demo', '2023100004', cDSM);
  const elisa = aluno('Elisa Prado', 'aluno4@fatec.demo', '2023100005', cDSM);
  const felipe = aluno('Felipe Araújo', 'aluno5@fatec.demo', '2023300006', cGE);
  const gabriel = aluno('Gabriel Nunes', 'aluno6@fatec.demo', '2024100007', cDSM);
  const isabela = aluno('Isabela Ramos', 'aluno7@fatec.demo', '2023200008', cADS);
  void ana;

  /* ---------------- concedentes ---------------- */
  const conc = (r, id, contato, sit) => ins('INSERT INTO concedente (razao_social, identificador, contato, situacao_convenio_declarada) VALUES (?, ?, ?, ?)', r, id, contato, sit);
  const tech = conc('TechNova Soluções Ltda. (EXEMPLO)', '00.000.000/0001-01', 'rh@technova.exemplo', 'DECLARADO_VIGENTE');
  const votor = conc('Votor Metais S.A. (EXEMPLO)', '00.000.000/0001-02', 'estagios@votormetais.exemplo', 'DECLARADO_VIGENTE');
  const pixel = conc('Agência Pixel Criativo (EXEMPLO)', '00.000.000/0001-03', 'contato@pixel.exemplo', 'NAO_VERIFICADO');
  conc('Prefeitura Exemplo — Depto. de TI (EXEMPLO)', '00.000.000/0001-04', 'ti@prefeitura.exemplo', 'DECLARADO_VIGENTE');
  void votor;

  /* ---------------- helpers de solicitação ---------------- */
  const arquivo = (linhas) => {
    const nome = crypto.randomUUID() + '.bin';
    const buf = pdfExemplo(linhas);
    fs.writeFileSync(path.join(UPLOAD_DIR, nome), buf);
    return { nome, tamanho: buf.length };
  };
  const doc = (solId, tipo, autor, dia, status = 'PENDENTE', conferidoPor = null, versao = 1) => {
    const f = arquivo([`Tipo: ${tipo}`, `Solicitacao #${solId}`, 'Conteudo ficticio para testes do sistema.']);
    return ins(
      `INSERT INTO documento (solicitacao_id, tipo, versao, nome_arquivo, caminho_seguro, mime_type, tamanho_bytes, enviado_por, data_envio, status, conferido_por, conferido_em)
       VALUES (?, ?, ?, ?, ?, 'application/pdf', ?, ?, ?, ?, ?, ?)`,
      solId, tipo, versao, `${tipo.toLowerCase()}_exemplo.pdf`, f.nome, f.tamanho, autor, tsRel(dia), status, conferidoPor, conferidoPor ? tsRel(dia + 1) : null
    );
  };
  const hist = (solId, passos) => {
    for (const [de, para, acao, autor, dia, motivo] of passos) {
      ins('INSERT INTO historico_status (solicitacao_id, status_anterior, status_novo, acao, autor_id, motivo, data_hora) VALUES (?, ?, ?, ?, ?, ?, ?)', solId, de, para, acao, autor, motivo || null, tsRel(dia));
    }
  };
  const solicitacao = (alunoObj, modalidade, status, campos = {}, plano = {}) => {
    const id = ins(
      `INSERT INTO solicitacao (aluno_id, modalidade, status, concedente_id, professor_id, tipo_atividade, orientador_nome, empresa_vinculo,
         seguro_situacao, seguro_responsavel, seguro_apolice, ass_aluno, ass_concedente, ass_coordenacao, ass_direcao, horas_reconhecidas,
         criada_em, enviada_em, atualizada_em, encerrada_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      alunoObj.id, modalidade, status, campos.concedente_id ?? null, campos.professor_id ?? null, campos.tipo_atividade ?? null,
      campos.orientador_nome ?? null, campos.empresa_vinculo ?? null, campos.seguro_situacao ?? 'NAO_INFORMADO', campos.seguro_responsavel ?? null,
      campos.seguro_apolice ?? null, campos.ass_aluno ?? 0, campos.ass_concedente ?? 0, campos.ass_coordenacao ?? 0, campos.ass_direcao ?? 0,
      campos.horas_reconhecidas ?? null, tsRel(campos.criada ?? -30), campos.enviada !== undefined ? tsRel(campos.enviada) : null,
      tsRel(campos.atualizada ?? -1), campos.encerrada !== undefined ? tsRel(campos.encerrada) : null
    );
    if (campos.enviada !== undefined) db.prepare('UPDATE solicitacao SET protocolo = ? WHERE id = ?').run(`EST-${hoje.getUTCFullYear()}-${String(id).padStart(6, '0')}`, id);
    ins(
      'INSERT INTO plano_atividade (solicitacao_id, descricao, tecnicas, compatibilidade, periodo_inicio, periodo_fim, horas_previstas) VALUES (?, ?, ?, ?, ?, ?, ?)',
      id, plano.descricao ?? null, plano.tecnicas ?? null, plano.compatibilidade ?? null, plano.periodo_inicio ?? null, plano.periodo_fim ?? null, plano.horas_previstas ?? null
    );
    return id;
  };
  const parecer = (solId, avaliador, tipo, resultado, justificativa, dia, horas = null) =>
    ins('INSERT INTO parecer (solicitacao_id, avaliador_id, tipo, resultado, horas_sugeridas, justificativa, data) VALUES (?, ?, ?, ?, ?, ?, ?)', solId, avaliador, tipo, resultado, horas, justificativa, tsRel(dia));

  const paeDev = {
    descricao: 'Desenvolvimento e manutenção de funcionalidades de sistema web interno, correção de defeitos e escrita de testes automatizados.',
    tecnicas: 'JavaScript, React, Node.js, SQL, Git, testes unitários.',
    compatibilidade: 'Atividades alinhadas às disciplinas de Desenvolvimento Web, Banco de Dados e Engenharia de Software do curso.',
    horas_previstas: 240,
  };

  /* 1) Bruno — matrícula irregular, rascunho completo (CA-01) */
  const s1 = solicitacao(bruno, 'REGULAR', 'RASCUNHO', { concedente_id: pixel, criada: -3, atualizada: -2 }, { ...paeDev, periodo_inicio: diaRel(10), periodo_fim: diaRel(130) });
  doc(s1, 'TCE', bruno.uid, -2);
  doc(s1, 'PAE', bruno.uid, -2);
  hist(s1, [[null, 'RASCUNHO', 'criar', bruno.uid, -3]]);

  /* 2) Gabriel — estágio regular enviado, aguardando a Secretaria */
  const s2 = solicitacao(gabriel, 'REGULAR', 'ENVIADO', { concedente_id: tech, criada: -4, enviada: -1, atualizada: -1 }, { ...paeDev, periodo_inicio: diaRel(15), periodo_fim: diaRel(195) });
  doc(s2, 'TCE', gabriel.uid, -2);
  doc(s2, 'PAE', gabriel.uid, -2);
  doc(s2, 'COMPROVANTE_MATRICULA', gabriel.uid, -2);
  hist(s2, [[null, 'RASCUNHO', 'criar', gabriel.uid, -4], ['RASCUNHO', 'ENVIADO', 'enviar', gabriel.uid, -1]]);

  /* 3) Felipe — equivalência em conferência com documentos pendentes */
  const s3 = solicitacao(felipe, 'EQUIVALENCIA', 'EM_CONFERENCIA', { empresa_vinculo: 'Votor Metais S.A. (EXEMPLO) — Assistente Administrativo', criada: -8, enviada: -6, atualizada: -5 }, {
    descricao: 'Atuação como assistente administrativo: rotinas de compras, controle de estoque e elaboração de relatórios gerenciais em planilhas.',
    periodo_inicio: diaRel(-400), periodo_fim: diaRel(-35), horas_previstas: 240,
  });
  doc(s3, 'COMPROVANTE_VINCULO', felipe.uid, -7);
  doc(s3, 'DESCRICAO_ATIVIDADES', felipe.uid, -7);
  hist(s3, [[null, 'RASCUNHO', 'criar', felipe.uid, -8], ['RASCUNHO', 'ENVIADO', 'enviar', felipe.uid, -6], ['ENVIADO', 'EM_CONFERENCIA', 'iniciar_conferencia', secretaria, -5]]);

  /* 4) Carla — equiparação em análise; curso ADS não prevê equiparação (CA-07) */
  const s4 = solicitacao(carla, 'EQUIPARACAO', 'EM_ANALISE_ACADEMICA', { professor_id: prof, tipo_atividade: 'MONITORIA', orientador_nome: 'Profa. Helena Souza', criada: -15, enviada: -12, atualizada: -3 }, {
    descricao: 'Monitoria da disciplina de Algoritmos: plantões de dúvidas semanais e apoio à correção de listas de exercícios.',
    periodo_inicio: diaRel(-200), periodo_fim: diaRel(-20), horas_previstas: 120,
  });
  doc(s4, 'RELATORIO_ATIVIDADE', carla.uid, -13, 'CONFERIDO', secretaria);
  doc(s4, 'DECLARACAO_ORIENTADOR', carla.uid, -13, 'CONFERIDO', secretaria);
  hist(s4, [
    [null, 'RASCUNHO', 'criar', carla.uid, -15],
    ['RASCUNHO', 'ENVIADO', 'enviar', carla.uid, -12],
    ['ENVIADO', 'EM_CONFERENCIA', 'iniciar_conferencia', secretaria, -11],
    ['EM_CONFERENCIA', 'EM_ANALISE_ACADEMICA', 'encaminhar_analise', secretaria, -10],
  ]);
  parecer(s4, prof, 'TECNICO', 'FAVORAVEL', 'Atividade de monitoria comprovada pela orientadora, com carga horária compatível.', -3, 120);

  /* 5) Carla — equivalência deferida parcialmente (encerrada) */
  const s5 = solicitacao(carla, 'EQUIVALENCIA', 'DEFERIDO_PARCIAL', { professor_id: prof2, empresa_vinculo: 'Agência Pixel Criativo (EXEMPLO) — Suporte de TI', horas_reconhecidas: 160, criada: -120, enviada: -118, atualizada: -90, encerrada: -90 }, {
    descricao: 'Suporte técnico a usuários, instalação de softwares e manutenção do site institucional da agência.',
    periodo_inicio: diaRel(-600), periodo_fim: diaRel(-200), horas_previstas: 240,
  });
  doc(s5, 'COMPROVANTE_VINCULO', carla.uid, -119, 'CONFERIDO', secretaria);
  doc(s5, 'DESCRICAO_ATIVIDADES', carla.uid, -119, 'CONFERIDO', secretaria);
  hist(s5, [
    [null, 'RASCUNHO', 'criar', carla.uid, -120],
    ['RASCUNHO', 'ENVIADO', 'enviar', carla.uid, -118],
    ['ENVIADO', 'EM_CONFERENCIA', 'iniciar_conferencia', secretaria, -117],
    ['EM_CONFERENCIA', 'EM_ANALISE_ACADEMICA', 'encaminhar_analise', secretaria, -115],
    ['EM_ANALISE_ACADEMICA', 'DEFERIDO_PARCIAL', 'decidir', coord, -90, 'Parte das atividades (suporte a usuários) é compatível; manutenção de site reconhecida parcialmente.'],
  ]);
  parecer(s5, prof2, 'TECNICO', 'FAVORAVEL', 'Atividades de suporte compatíveis com o perfil do curso; sugerido reconhecimento parcial.', -100, 160);
  parecer(s5, coord, 'ACADEMICO', 'DEFERIDO_PARCIAL', 'Parte das atividades (suporte a usuários) é compatível; manutenção de site reconhecida parcialmente.', -90, 160);

  /* 6) Isabela — estágio regular aguardando assinatura da Direção */
  const s6 = solicitacao(isabela, 'REGULAR', 'AGUARDANDO_ASSINATURA', {
    concedente_id: tech, professor_id: prof, seguro_situacao: 'CONTRATADO_CONCEDENTE', seguro_responsavel: 'TechNova Soluções Ltda. (EXEMPLO)', seguro_apolice: 'AP-0001-EXEMPLO',
    ass_aluno: 1, ass_concedente: 1, ass_coordenacao: 1, criada: -20, enviada: -18, atualizada: -2,
  }, { ...paeDev, periodo_inicio: diaRel(7), periodo_fim: diaRel(187) });
  doc(s6, 'TCE', isabela.uid, -19, 'CONFERIDO', secretaria);
  doc(s6, 'PAE', isabela.uid, -19, 'CONFERIDO', secretaria);
  hist(s6, [
    [null, 'RASCUNHO', 'criar', isabela.uid, -20],
    ['RASCUNHO', 'ENVIADO', 'enviar', isabela.uid, -18],
    ['ENVIADO', 'EM_CONFERENCIA', 'iniciar_conferencia', secretaria, -17],
    ['EM_CONFERENCIA', 'EM_ANALISE_ACADEMICA', 'encaminhar_analise', secretaria, -15],
    ['EM_ANALISE_ACADEMICA', 'AGUARDANDO_ASSINATURA', 'aprovar_plano', coord, -2, 'PAE compatível com o PPC do curso.'],
  ]);
  parecer(s6, prof, 'TECNICO', 'FAVORAVEL', 'PAE descreve atividades, técnicas e duração compatíveis com o curso.', -5);
  parecer(s6, coord, 'ACADEMICO', 'APROVADO', 'PAE compatível com o PPC do curso.', -2);

  /* 7) Diego — estágio regular em execução, com horas e relatório parcial */
  const s7 = solicitacao(diego, 'REGULAR', 'EM_EXECUCAO', {
    concedente_id: tech, professor_id: prof, seguro_situacao: 'CONTRATADO_CONCEDENTE', seguro_responsavel: 'TechNova Soluções Ltda. (EXEMPLO)', seguro_apolice: 'AP-0002-EXEMPLO',
    ass_aluno: 1, ass_concedente: 1, ass_coordenacao: 1, ass_direcao: 1, criada: -110, enviada: -108, atualizada: -10,
  }, { ...paeDev, periodo_inicio: diaRel(-90), periodo_fim: diaRel(90) });
  doc(s7, 'TCE', diego.uid, -109, 'CONFERIDO', secretaria);
  doc(s7, 'PAE', diego.uid, -109, 'CONFERIDO', secretaria);
  hist(s7, [
    [null, 'RASCUNHO', 'criar', diego.uid, -110],
    ['RASCUNHO', 'ENVIADO', 'enviar', diego.uid, -108],
    ['ENVIADO', 'EM_CONFERENCIA', 'iniciar_conferencia', secretaria, -107],
    ['EM_CONFERENCIA', 'EM_ANALISE_ACADEMICA', 'encaminhar_analise', secretaria, -105],
    ['EM_ANALISE_ACADEMICA', 'AGUARDANDO_ASSINATURA', 'aprovar_plano', coord, -100, 'PAE aprovado.'],
    ['AGUARDANDO_ASSINATURA', 'FORMALIZADO', 'assinar', direcao, -96],
    ['FORMALIZADO', 'EM_EXECUCAO', 'liberar', secretaria, -95, 'Documentação completa; estágio liberado.'],
  ]);
  parecer(s7, prof, 'TECNICO', 'FAVORAVEL', 'Plano adequado.', -102);
  parecer(s7, coord, 'ACADEMICO', 'APROVADO', 'PAE aprovado.', -100);
  for (let i = 0; i < 8; i++) {
    ins('INSERT INTO registro_hora (solicitacao_id, data, horas, descricao, validado, validado_por) VALUES (?, ?, ?, ?, ?, ?)',
      s7, diaRel(-85 + i * 7), 6, `Semana ${i + 1}: desenvolvimento de funcionalidades e reuniões de acompanhamento.`, i < 5 ? 'VALIDADO' : 'PENDENTE', i < 5 ? prof : null);
  }

  /* 8) Elisa — estágio regular em avaliação final: tudo pronto para o professor aprovar e a Secretaria encerrar */
  const s8 = solicitacao(elisa, 'REGULAR', 'EM_AVALIACAO_FINAL', {
    concedente_id: tech, professor_id: prof, seguro_situacao: 'CONTRATADO_INSTITUICAO', seguro_responsavel: 'Centro Paula Souza (EXEMPLO)', seguro_apolice: 'AP-0003-EXEMPLO',
    ass_aluno: 1, ass_concedente: 1, ass_coordenacao: 1, ass_direcao: 1, criada: -230, enviada: -228, atualizada: -2,
  }, { ...paeDev, periodo_inicio: diaRel(-200), periodo_fim: diaRel(-5) });
  doc(s8, 'TCE', elisa.uid, -229, 'CONFERIDO', secretaria);
  doc(s8, 'PAE', elisa.uid, -229, 'CONFERIDO', secretaria);
  hist(s8, [
    [null, 'RASCUNHO', 'criar', elisa.uid, -230],
    ['RASCUNHO', 'ENVIADO', 'enviar', elisa.uid, -228],
    ['ENVIADO', 'EM_CONFERENCIA', 'iniciar_conferencia', secretaria, -227],
    ['EM_CONFERENCIA', 'EM_ANALISE_ACADEMICA', 'encaminhar_analise', secretaria, -225],
    ['EM_ANALISE_ACADEMICA', 'AGUARDANDO_ASSINATURA', 'aprovar_plano', coord, -215, 'PAE aprovado.'],
    ['AGUARDANDO_ASSINATURA', 'FORMALIZADO', 'assinar', direcao, -210],
    ['FORMALIZADO', 'EM_EXECUCAO', 'liberar', secretaria, -205],
    ['EM_EXECUCAO', 'EM_AVALIACAO_FINAL', 'solicitar_avaliacao_final', elisa.uid, -2],
  ]);
  parecer(s8, prof, 'TECNICO', 'FAVORAVEL', 'Plano adequado ao curso.', -218);
  parecer(s8, coord, 'ACADEMICO', 'APROVADO', 'PAE aprovado.', -215);
  for (let i = 0; i < 20; i++) {
    ins('INSERT INTO registro_hora (solicitacao_id, data, horas, descricao, validado, validado_por) VALUES (?, ?, ?, ?, ?, ?)',
      s8, diaRel(-195 + i * 9), 12, `Atividades de desenvolvimento — bloco ${i + 1}.`, 'VALIDADO', prof);
  }
  const dp = doc(s8, 'RELATORIO_PARCIAL', elisa.uid, -100);
  ins("INSERT INTO relatorio (solicitacao_id, tipo, periodo, arquivo_id, estado_avaliacao, avaliado_por, observacao, enviado_em, avaliado_em) VALUES (?, 'PARCIAL', ?, ?, 'APROVADO', ?, 'Relatório adequado.', ?, ?)",
    s8, '1º trimestre', dp, prof, tsRel(-100), tsRel(-95));
  const df = doc(s8, 'RELATORIO_FINAL', elisa.uid, -3);
  ins("INSERT INTO relatorio (solicitacao_id, tipo, periodo, arquivo_id, enviado_em) VALUES (?, 'FINAL', ?, ?, ?)", s8, 'Período completo', df, tsRel(-3));

  return { admin };
}

function limparUploads() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  for (const f of fs.readdirSync(UPLOAD_DIR)) if (f.endsWith('.bin')) fs.rmSync(path.join(UPLOAD_DIR, f));
}

function seedSeVazio() {
  const db = getDb();
  if (db.prepare('SELECT COUNT(*) AS n FROM usuario').get().n > 0) return false;
  limparUploads();
  transaction((conn) => seed(conn));
  console.log(`Banco populado com dados fictícios. Senha de todos os usuários: ${SENHA_PADRAO}`);
  return true;
}

if (require.main === module) {
  closeDb();
  for (const f of [DB_FILE, DB_FILE + '-wal', DB_FILE + '-shm']) fs.rmSync(f, { force: true });
  seedSeVazio();
  closeDb();
}

module.exports = { seedSeVazio, SENHA_PADRAO };
