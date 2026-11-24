import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../services/auth';
import { PERFIL_ROTULO } from '../services/format';
import { Campo, Carregando, ErroBox, Modal, Sucesso } from '../components/ui';

/** RF-02: cadastros de alunos, cursos, concedentes e usuários. */
export default function Cadastros() {
  const { usuario } = useAuth();
  const perfil = usuario.perfil;
  const abas = [
    ['alunos', 'Alunos', true],
    ['cursos', 'Cursos', true],
    ['concedentes', 'Concedentes', perfil !== 'COORDENACAO'],
    ['usuarios', 'Usuários e perfis', perfil === 'ADMIN'],
  ].filter((a) => a[2]);
  const [aba, setAba] = useState(abas[0][0]);
  const [mensagem, setMensagem] = useState('');

  return (
    <>
      <div className="cabecalho-pagina">
        <h1>Cadastros</h1>
      </div>
      <div className="abas" role="tablist" aria-label="Tipos de cadastro">
        {abas.map(([k, r]) => (
          <button key={k} role="tab" id={`aba-${k}`} aria-selected={aba === k} aria-controls={`painel-${k}`} className={aba === k ? 'ativa' : ''} onClick={() => { setAba(k); setMensagem(''); }}>
            {r}
          </button>
        ))}
      </div>
      <Sucesso>{mensagem}</Sucesso>
      <div role="tabpanel" id={`painel-${aba}`} aria-labelledby={`aba-${aba}`}>
        {aba === 'alunos' && <Alunos podeEditar={perfil !== 'COORDENACAO'} aoSalvar={setMensagem} />}
        {aba === 'cursos' && <Cursos podeEditar={['ADMIN', 'COORDENACAO'].includes(perfil)} aoSalvar={setMensagem} />}
        {aba === 'concedentes' && <Concedentes aoSalvar={setMensagem} />}
        {aba === 'usuarios' && <Usuarios aoSalvar={setMensagem} />}
      </div>
    </>
  );
}

function useLista(rota) {
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState(null);
  const carregar = useCallback(() => api.get(rota).then(setLista).catch(setErro), [rota]);
  useEffect(() => {
    carregar();
  }, [carregar]);
  return { lista, erro, carregar };
}

function Alunos({ podeEditar, aoSalvar }) {
  const { lista, erro, carregar } = useLista('/alunos');
  const [erroAcao, setErroAcao] = useState(null);
  const [filtro, setFiltro] = useState('');
  const alternar = async (a) => {
    setErroAcao(null);
    try {
      const nova = a.situacao_matricula === 'REGULAR' ? 'IRREGULAR' : 'REGULAR';
      await api.put(`/alunos/${a.id}`, { situacao_matricula: nova });
      aoSalvar(`Matrícula de ${a.nome} marcada como ${nova.toLowerCase()}.`);
      carregar();
    } catch (err) {
      setErroAcao(err);
    }
  };
  if (erro) return <ErroBox erro={erro} />;
  if (!lista) return <Carregando />;
  const filtrados = lista.filter((a) => `${a.nome} ${a.matricula} ${a.email}`.toLowerCase().includes(filtro.toLowerCase()));
  return (
    <section className="cartao">
      <p className="ajuda">A situação de matrícula é verificada pela Secretaria (validação humana — não há integração com o sistema acadêmico). Novos alunos são criados pelo administrador em “Usuários e perfis”.</p>
      <Campo rotulo="Buscar aluno">{(id) => <input id={id} type="search" value={filtro} onChange={(e) => setFiltro(e.target.value)} />}</Campo>
      <ErroBox erro={erroAcao} />
      <div className="tabela-rolagem">
        <table className="tabela">
          <thead>
            <tr>
              <th scope="col">Nome</th>
              <th scope="col">Matrícula</th>
              <th scope="col">Curso</th>
              <th scope="col">Situação da matrícula</th>
              {podeEditar && <th scope="col"><span className="sr-only">Ações</span></th>}
            </tr>
          </thead>
          <tbody>
            {filtrados.map((a) => (
              <tr key={a.id}>
                <td data-rotulo="Nome">
                  {a.nome}
                  <small className="bloco">{a.email}</small>
                </td>
                <td data-rotulo="Matrícula">{a.matricula}</td>
                <td data-rotulo="Curso">{a.curso_nome}</td>
                <td data-rotulo="Situação">
                  <span className={`selo-doc doc-${a.situacao_matricula === 'REGULAR' ? 'conferido' : 'rejeitado'}`}>{a.situacao_matricula === 'REGULAR' ? 'Regular' : 'Irregular'}</span>
                </td>
                {podeEditar && (
                  <td data-rotulo="Ações">
                    <button className="botao botao-pequeno botao-secundario" onClick={() => alternar(a)}>
                      Marcar como {a.situacao_matricula === 'REGULAR' ? 'irregular' : 'regular'}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Cursos({ podeEditar, aoSalvar }) {
  const { lista, erro, carregar } = useLista('/cursos');
  const [editando, setEditando] = useState(null);
  if (erro) return <ErroBox erro={erro} />;
  if (!lista) return <Carregando />;
  return (
    <section className="cartao">
      {podeEditar && (
        <button className="botao botao-primario" onClick={() => setEditando({ nome: '', carga_horaria_estagio: 240, permite_equiparacao: false, ativo: true })}>
          + Novo curso
        </button>
      )}
      <div className="tabela-rolagem">
        <table className="tabela">
          <thead>
            <tr>
              <th scope="col">Curso</th>
              <th scope="col">Carga horária de estágio</th>
              <th scope="col">PPC prevê equiparação</th>
              <th scope="col">Ativo</th>
              {podeEditar && <th scope="col"><span className="sr-only">Ações</span></th>}
            </tr>
          </thead>
          <tbody>
            {lista.map((c) => (
              <tr key={c.id}>
                <td data-rotulo="Curso">{c.nome}</td>
                <td data-rotulo="Carga horária">{c.carga_horaria_estagio}h</td>
                <td data-rotulo="Equiparação">{c.permite_equiparacao ? 'Sim' : 'Não'}</td>
                <td data-rotulo="Ativo">{c.ativo ? 'Sim' : 'Não'}</td>
                {podeEditar && (
                  <td data-rotulo="Ações">
                    <button className="botao botao-pequeno botao-secundario" onClick={() => setEditando({ ...c, permite_equiparacao: Boolean(c.permite_equiparacao), ativo: Boolean(c.ativo) })}>
                      Editar
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <FormModal
        titulo={editando?.id ? 'Editar curso' : 'Novo curso'}
        item={editando}
        aoFechar={() => setEditando(null)}
        salvar={(f) => (f.id ? api.put(`/cursos/${f.id}`, f) : api.post('/cursos', f))}
        aoSalvar={() => {
          aoSalvar('Curso salvo.');
          setEditando(null);
          carregar();
        }}
        campos={[
          ['nome', 'Nome do curso', 'text'],
          ['carga_horaria_estagio', 'Carga horária de estágio (h)', 'number'],
          ['permite_equiparacao', 'O PPC prevê equiparação de atividades acadêmicas', 'checkbox'],
          ['ativo', 'Ativo', 'checkbox'],
        ]}
      />
    </section>
  );
}

const CONVENIO = { DECLARADO_VIGENTE: 'Declarado vigente', NAO_VERIFICADO: 'Não verificado', SEM_CONVENIO: 'Sem convênio' };

function Concedentes({ aoSalvar }) {
  const { lista, erro, carregar } = useLista('/concedentes');
  const [editando, setEditando] = useState(null);
  if (erro) return <ErroBox erro={erro} />;
  if (!lista) return <Carregando />;
  return (
    <section className="cartao">
      <p className="ajuda">A situação do convênio é apenas declarada — a consulta a convênios é validação humana, não automática.</p>
      <button className="botao botao-primario" onClick={() => setEditando({ razao_social: '', identificador: '', contato: '', situacao_convenio_declarada: 'NAO_VERIFICADO', ativo: true })}>
        + Nova concedente
      </button>
      <div className="tabela-rolagem">
        <table className="tabela">
          <thead>
            <tr>
              <th scope="col">Razão social</th>
              <th scope="col">Identificador</th>
              <th scope="col">Contato</th>
              <th scope="col">Convênio</th>
              <th scope="col">Ativa</th>
              <th scope="col"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            {lista.map((c) => (
              <tr key={c.id}>
                <td data-rotulo="Razão social">{c.razao_social}</td>
                <td data-rotulo="Identificador">{c.identificador}</td>
                <td data-rotulo="Contato">{c.contato || '—'}</td>
                <td data-rotulo="Convênio">{CONVENIO[c.situacao_convenio_declarada]}</td>
                <td data-rotulo="Ativa">{c.ativo ? 'Sim' : 'Não'}</td>
                <td data-rotulo="Ações">
                  <button className="botao botao-pequeno botao-secundario" onClick={() => setEditando({ ...c, ativo: Boolean(c.ativo) })}>
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <FormModal
        titulo={editando?.id ? 'Editar concedente' : 'Nova concedente'}
        item={editando}
        aoFechar={() => setEditando(null)}
        salvar={(f) => (f.id ? api.put(`/concedentes/${f.id}`, f) : api.post('/concedentes', f))}
        aoSalvar={() => {
          aoSalvar('Concedente salva.');
          setEditando(null);
          carregar();
        }}
        campos={[
          ['razao_social', 'Razão social', 'text'],
          ['identificador', 'Identificador (CNPJ fictício ou código interno)', 'text'],
          ['contato', 'Contato', 'text'],
          ['situacao_convenio_declarada', 'Situação do convênio (declarada)', 'select', CONVENIO],
          ['ativo', 'Ativa', 'checkbox'],
        ]}
      />
    </section>
  );
}

function Usuarios({ aoSalvar }) {
  const { lista, erro, carregar } = useLista('/usuarios');
  const { lista: cursos } = useLista('/cursos');
  const [editando, setEditando] = useState(null);
  if (erro) return <ErroBox erro={erro} />;
  if (!lista || !cursos) return <Carregando />;
  const opcoesCurso = Object.fromEntries(cursos.map((c) => [c.id, c.nome]));
  const novo = !editando?.id;
  return (
    <section className="cartao">
      <p className="ajuda">O administrador técnico gerencia contas e perfis, mas não pode alterar pareceres acadêmicos.</p>
      <button className="botao botao-primario" onClick={() => setEditando({ nome: '', email: '', perfil: 'ALUNO', senha: '', matricula: '', curso_id: cursos[0]?.id || '', ativo: true })}>
        + Novo usuário
      </button>
      <div className="tabela-rolagem">
        <table className="tabela">
          <thead>
            <tr>
              <th scope="col">Nome</th>
              <th scope="col">E-mail</th>
              <th scope="col">Perfil</th>
              <th scope="col">Ativo</th>
              <th scope="col"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            {lista.map((u) => (
              <tr key={u.id}>
                <td data-rotulo="Nome">
                  {u.nome}
                  {u.matricula && <small className="bloco">{u.matricula} · {u.curso_nome}</small>}
                </td>
                <td data-rotulo="E-mail">{u.email}</td>
                <td data-rotulo="Perfil">{PERFIL_ROTULO[u.perfil]}</td>
                <td data-rotulo="Ativo">{u.ativo ? 'Sim' : 'Não'}</td>
                <td data-rotulo="Ações">
                  <button className="botao botao-pequeno botao-secundario" onClick={() => setEditando({ id: u.id, nome: u.nome, ativo: Boolean(u.ativo), senha: '' })}>
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <FormModal
        titulo={novo ? 'Novo usuário' : 'Editar usuário'}
        item={editando}
        aoFechar={() => setEditando(null)}
        salvar={(f) => (f.id ? api.put(`/usuarios/${f.id}`, f) : api.post('/usuarios', f))}
        aoSalvar={() => {
          aoSalvar('Usuário salvo.');
          setEditando(null);
          carregar();
        }}
        campos={
          novo
            ? [
                ['nome', 'Nome', 'text'],
                ['email', 'E-mail', 'email'],
                ['perfil', 'Perfil', 'select', PERFIL_ROTULO],
                ['senha', 'Senha inicial (mín. 8 caracteres)', 'password'],
                ['matricula', 'Matrícula (alunos)', 'text', null, (f) => f.perfil === 'ALUNO'],
                ['curso_id', 'Curso (alunos)', 'select', opcoesCurso, (f) => f.perfil === 'ALUNO'],
              ]
            : [
                ['nome', 'Nome', 'text'],
                ['senha', 'Nova senha (deixe em branco para manter)', 'password'],
                ['ativo', 'Conta ativa', 'checkbox'],
              ]
        }
      />
    </section>
  );
}

/** Formulário genérico em modal para os cadastros simples. */
function FormModal({ titulo, item, campos, salvar, aoSalvar, aoFechar }) {
  const [form, setForm] = useState(item || {});
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    setForm(item || {});
    setErro(null);
  }, [item]);

  const enviar = async (e) => {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      await salvar(form);
      aoSalvar();
    } catch (err) {
      setErro(err);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal titulo={titulo} aberto={Boolean(item)} aoFechar={aoFechar}>
      <form onSubmit={enviar}>
        {campos
          .filter(([, , , , visivel]) => !visivel || visivel(form))
          .map(([k, rotulo, tipo, opcoes]) =>
            tipo === 'checkbox' ? (
              <label key={k} className="checkbox">
                <input type="checkbox" checked={Boolean(form[k])} onChange={(e) => setForm({ ...form, [k]: e.target.checked })} /> {rotulo}
              </label>
            ) : (
              <Campo key={k} rotulo={rotulo}>
                {(id) =>
                  tipo === 'select' ? (
                    <select id={id} value={form[k] ?? ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })}>
                      {Object.entries(opcoes).map(([v, r]) => (
                        <option key={v} value={v}>
                          {r}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input id={id} type={tipo} value={form[k] ?? ''} autoComplete={tipo === 'password' ? 'new-password' : undefined} onChange={(e) => setForm({ ...form, [k]: tipo === 'number' ? Number(e.target.value) : e.target.value })} />
                  )
                }
              </Campo>
            )
          )}
        <ErroBox erro={erro} />
        <div className="acoes-formulario">
          <button type="button" className="botao botao-secundario" onClick={aoFechar}>
            Cancelar
          </button>
          <button className="botao botao-primario" disabled={salvando}>
            Salvar
          </button>
        </div>
      </form>
    </Modal>
  );
}
