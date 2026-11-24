import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { fmtDataHora, PERFIL_ROTULO } from '../services/format';
import { Campo, Carregando, ErroBox, Vazio } from '../components/ui';

const ACOES = [
  'LOGIN_SUCESSO', 'LOGIN_FALHA', 'SOLICITACAO_CRIADA', 'SOLICITACAO_EDITADA', 'DOCUMENTO_ENVIADO', 'DOCUMENTO_BAIXADO', 'DOCUMENTO_CONFERIDO',
  'CONFERENCIA_ATUALIZADA', 'TRANSICAO_STATUS', 'TRANSICAO_RECUSADA', 'PARECER_REGISTRADO', 'HORAS_REGISTRADAS', 'HORAS_VALIDADAS',
  'RELATORIO_ENVIADO', 'RELATORIO_AVALIADO', 'USUARIO_CRIADO', 'USUARIO_ATUALIZADO', 'ALUNO_ATUALIZADO', 'CURSO_CRIADO', 'CURSO_ATUALIZADO',
  'CONCEDENTE_CRIADA', 'CONCEDENTE_ATUALIZADA',
];

/** RF-10: trilha de auditoria geral. */
export default function Auditoria() {
  const [filtros, setFiltros] = useState({ acao: '', usuario: '' });
  const [aplicados, setAplicados] = useState(filtros);
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    setLista(null);
    const q = new URLSearchParams(Object.entries(aplicados).filter(([, v]) => v));
    api.get(`/auditoria?${q}`).then(setLista).catch(setErro);
  }, [aplicados]);

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Auditoria</h1>
          <p className="subtitulo">Últimos 200 eventos registrados (ações, decisões, uploads, cadastros e acessos).</p>
        </div>
      </div>
      <form
        className="cartao filtros"
        onSubmit={(e) => {
          e.preventDefault();
          setAplicados(filtros);
        }}
      >
        <Campo rotulo="Ação">
          {(id) => (
            <select id={id} value={filtros.acao} onChange={(e) => setFiltros({ ...filtros, acao: e.target.value })}>
              <option value="">Todas</option>
              {ACOES.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          )}
        </Campo>
        <Campo rotulo="Usuário">{(id) => <input id={id} type="search" value={filtros.usuario} onChange={(e) => setFiltros({ ...filtros, usuario: e.target.value })} />}</Campo>
        <div className="filtros-acoes">
          <button className="botao botao-primario">Filtrar</button>
        </div>
      </form>
      <ErroBox erro={erro} />
      {!lista && !erro && <Carregando />}
      {lista && (
        <section className="cartao">
          {!lista.length ? (
            <Vazio>Nenhum evento.</Vazio>
          ) : (
            <div className="tabela-rolagem">
              <table className="tabela tabela-compacta">
                <thead>
                  <tr>
                    <th scope="col">Data/hora</th>
                    <th scope="col">Usuário</th>
                    <th scope="col">Ação</th>
                    <th scope="col">Registro</th>
                    <th scope="col">Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((a) => (
                    <tr key={a.id}>
                      <td data-rotulo="Data/hora">{fmtDataHora(a.data_hora)}</td>
                      <td data-rotulo="Usuário">
                        {a.usuario_nome || '—'}
                        {a.usuario_perfil && <small className="bloco">{PERFIL_ROTULO[a.usuario_perfil]}</small>}
                      </td>
                      <td data-rotulo="Ação">
                        <code>{a.acao}</code>
                      </td>
                      <td data-rotulo="Registro">
                        {a.entidade === 'solicitacao' ? <Link to={`/solicitacoes/${a.entidade_id}`}>Solicitação #{a.entidade_id}</Link> : `${a.entidade} #${a.entidade_id ?? '—'}`}
                      </td>
                      <td data-rotulo="Detalhes">{a.detalhes ? <code className="detalhes-json">{JSON.stringify(a.detalhes)}</code> : '—'}</td>
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
