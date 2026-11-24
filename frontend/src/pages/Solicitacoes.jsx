import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../services/auth';
import { fmtDataHora } from '../services/format';
import { Campo, Carregando, ErroBox, StatusBadge, Vazio } from '../components/ui';

/** RF-09: pesquisa por status, curso, aluno e modalidade. */
export default function Solicitacoes() {
  const { usuario, dominios } = useAuth();
  const [params, setParams] = useSearchParams();
  const [lista, setLista] = useState(null);
  const [cursos, setCursos] = useState([]);
  const [erro, setErro] = useState(null);
  const aluno = usuario.perfil === 'ALUNO';
  const fila = params.get('fila') === '1';

  const [filtros, setFiltros] = useState({
    status: params.get('status') || '',
    modalidade: params.get('modalidade') || '',
    curso_id: params.get('curso_id') || '',
    aluno: params.get('aluno') || '',
  });

  useEffect(() => {
    api.get('/cursos').then(setCursos).catch(() => {});
  }, []);

  useEffect(() => {
    setLista(null);
    setErro(null);
    api
      .get(`/solicitacoes?${params.toString()}`)
      .then(setLista)
      .catch(setErro);
  }, [params]);

  useEffect(() => {
    setFiltros({ status: params.get('status') || '', modalidade: params.get('modalidade') || '', curso_id: params.get('curso_id') || '', aluno: params.get('aluno') || '' });
  }, [params]);

  const aplicar = (e) => {
    e.preventDefault();
    const novo = new URLSearchParams();
    if (fila) novo.set('fila', '1');
    Object.entries(filtros).forEach(([k, v]) => v && novo.set(k, v));
    setParams(novo);
  };
  const limpar = () => setParams(fila ? { fila: '1' } : {});

  const titulo = aluno ? 'Minhas solicitações' : fila ? (usuario.perfil === 'ADMIN' ? 'Solicitações' : 'Minha fila de trabalho') : 'Pesquisar solicitações';

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>{titulo}</h1>
          {fila && usuario.perfil !== 'ADMIN' && <p className="subtitulo">Solicitações que aguardam uma ação do seu perfil.</p>}
        </div>
        {aluno && (
          <Link className="botao botao-primario" to="/solicitacoes/nova">
            + Nova solicitação
          </Link>
        )}
      </div>

      <form className="cartao filtros" onSubmit={aplicar} role="search" aria-label="Filtros de solicitações">
        <Campo rotulo="Situação">
          {(id) => (
            <select id={id} value={filtros.status} onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}>
              <option value="">Todas</option>
              {Object.entries(dominios.status).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <Campo rotulo="Modalidade">
          {(id) => (
            <select id={id} value={filtros.modalidade} onChange={(e) => setFiltros({ ...filtros, modalidade: e.target.value })}>
              <option value="">Todas</option>
              {Object.entries(dominios.modalidades).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          )}
        </Campo>
        {!aluno && (
          <>
            <Campo rotulo="Curso">
              {(id) => (
                <select id={id} value={filtros.curso_id} onChange={(e) => setFiltros({ ...filtros, curso_id: e.target.value })}>
                  <option value="">Todos</option>
                  {cursos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
            <Campo rotulo="Aluno, matrícula ou protocolo">
              {(id) => <input id={id} type="search" value={filtros.aluno} onChange={(e) => setFiltros({ ...filtros, aluno: e.target.value })} />}
            </Campo>
          </>
        )}
        <div className="filtros-acoes">
          <button className="botao botao-primario">Filtrar</button>
          <button type="button" className="botao botao-secundario" onClick={limpar}>
            Limpar
          </button>
        </div>
      </form>

      <ErroBox erro={erro} />
      {!lista && !erro && <Carregando />}
      {lista && (
        <section className="cartao">
          <p className="contagem" aria-live="polite">
            {lista.length} solicitação(ões) encontrada(s)
          </p>
          {!lista.length ? (
            <Vazio>{fila ? 'Nada aguardando sua ação no momento.' : 'Nenhuma solicitação encontrada com esses filtros.'}</Vazio>
          ) : (
            <div className="tabela-rolagem">
              <table className="tabela">
                <thead>
                  <tr>
                    <th scope="col">Protocolo</th>
                    {!aluno && <th scope="col">Aluno</th>}
                    {!aluno && <th scope="col">Curso</th>}
                    <th scope="col">Modalidade</th>
                    <th scope="col">Situação</th>
                    <th scope="col">Responsável</th>
                    <th scope="col">Atualizada</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((s) => (
                    <tr key={s.id} className={s.requer_minha_acao ? 'linha-destaque' : ''}>
                      <td data-rotulo="Protocolo">
                        <Link to={`/solicitacoes/${s.id}`}>{s.protocolo || `Rascunho #${s.id}`}</Link>
                        {s.requer_minha_acao && <span className="marcador">ação pendente</span>}
                      </td>
                      {!aluno && (
                        <td data-rotulo="Aluno">
                          {s.aluno_nome}
                          <br />
                          <small>{s.matricula}</small>
                        </td>
                      )}
                      {!aluno && <td data-rotulo="Curso">{s.curso_nome}</td>}
                      <td data-rotulo="Modalidade">{dominios.modalidades[s.modalidade]}</td>
                      <td data-rotulo="Situação">
                        <StatusBadge status={s.status} />
                      </td>
                      <td data-rotulo="Responsável">{s.professor_nome || '—'}</td>
                      <td data-rotulo="Atualizada">{fmtDataHora(s.atualizada_em)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}
