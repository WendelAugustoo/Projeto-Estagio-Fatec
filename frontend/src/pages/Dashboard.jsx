import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../services/auth';
import { fmtDataHora } from '../services/format';
import { Carregando, ErroBox, StatusBadge, Vazio } from '../components/ui';

function TabelaSolicitacoes({ itens, mostrarAluno }) {
  const { dominios } = useAuth();
  if (!itens.length) return <Vazio>Nenhuma solicitação.</Vazio>;
  return (
    <div className="tabela-rolagem">
      <table className="tabela">
        <thead>
          <tr>
            <th scope="col">Protocolo</th>
            {mostrarAluno && <th scope="col">Aluno</th>}
            <th scope="col">Modalidade</th>
            <th scope="col">Situação</th>
            <th scope="col">Atualizada</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((s) => (
            <tr key={s.id}>
              <td data-rotulo="Protocolo">
                <Link to={`/solicitacoes/${s.id}`}>{s.protocolo || `Rascunho #${s.id}`}</Link>
              </td>
              {mostrarAluno && <td data-rotulo="Aluno">{s.aluno_nome}</td>}
              <td data-rotulo="Modalidade">{dominios.modalidades[s.modalidade]}</td>
              <td data-rotulo="Situação">
                <StatusBadge status={s.status} />
              </td>
              <td data-rotulo="Atualizada">{fmtDataHora(s.atualizada_em)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Barras({ dados, rotulos }) {
  const entradas = Object.entries(dados).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entradas.map(([, v]) => v));
  if (!entradas.length) return <Vazio>Sem dados.</Vazio>;
  return (
    <ul className="barras">
      {entradas.map(([k, v]) => (
        <li key={k}>
          <span className="barra-rotulo">{rotulos[k] || k}</span>
          <span className="barra-trilho" aria-hidden="true">
            <span className="barra" style={{ width: `${(v / max) * 100}%` }} />
          </span>
          <span className="barra-valor">{v}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Dashboard() {
  const { usuario, dominios } = useAuth();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const aluno = usuario.perfil === 'ALUNO';

  useEffect(() => {
    api.get('/dashboard').then(setDados).catch(setErro);
  }, []);

  if (erro) return <ErroBox erro={erro} />;
  if (!dados) return <Carregando />;

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Olá, {usuario.nome.split(' ')[0]}</h1>
          <p className="subtitulo">
            {aluno
              ? `${usuario.aluno?.curso_nome} · matrícula ${usuario.aluno?.matricula}`
              : 'Painel operacional das solicitações de estágio.'}
          </p>
        </div>
        {aluno && (
          <Link className="botao botao-primario" to="/solicitacoes/nova">
            + Nova solicitação
          </Link>
        )}
      </div>

      {aluno && usuario.aluno?.situacao_matricula === 'IRREGULAR' && (
        <div className="alerta alerta-aviso" role="status">
          Sua matrícula consta como <strong>irregular</strong>. Solicitações de estágio regular ficam bloqueadas até a regularização na Secretaria.
        </div>
      )}

      <section className="cartoes-numeros" aria-label="Indicadores">
        <div className="cartao-numero">
          <span>{dados.total}</span>
          <small>{aluno ? 'Minhas solicitações' : 'Solicitações visíveis'}</small>
        </div>
        <div className="cartao-numero">
          <span>{dados.em_andamento}</span>
          <small>Em andamento</small>
        </div>
        <div className="cartao-numero">
          <span>{dados.concluidas}</span>
          <small>Encerradas</small>
        </div>
        <div className={`cartao-numero ${dados.fila_total ? 'destaque' : ''}`}>
          <span>{dados.fila_total}</span>
          <small>{aluno ? 'Aguardando minha ação' : 'Na minha fila'}</small>
        </div>
        {dados.alunos_irregulares !== undefined && (
          <div className="cartao-numero">
            <span>{dados.alunos_irregulares}</span>
            <small>Alunos com matrícula irregular</small>
          </div>
        )}
      </section>

      {aluno && dados.pendencias?.length > 0 && (
        <section className="cartao">
          <h2>Pendências</h2>
          {dados.pendencias.map((p) => (
            <div key={p.id} className="pendencia-bloco">
              <Link to={`/solicitacoes/${p.id}`}>
                {p.protocolo || `Rascunho #${p.id}`} — {dominios.modalidades[p.modalidade]}
              </Link>{' '}
              <StatusBadge status={p.status} />
              <ul>
                {p.itens.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      <div className="grade-2">
        <section className="cartao">
          <h2>{aluno ? 'Aguardando minha ação' : 'Minha fila de trabalho'}</h2>
          <TabelaSolicitacoes itens={dados.fila} mostrarAluno={!aluno} />
          {dados.fila_total > dados.fila.length && (
            <p>
              <Link to="/solicitacoes?fila=1">Ver todas ({dados.fila_total})</Link>
            </p>
          )}
        </section>
        <section className="cartao">
          <h2>Por situação</h2>
          <Barras dados={dados.por_status} rotulos={dominios.status} />
          <h2 className="mt">Por modalidade</h2>
          <Barras dados={dados.por_modalidade} rotulos={dominios.modalidades} />
        </section>
      </div>

      <section className="cartao">
        <h2>Atualizadas recentemente</h2>
        <TabelaSolicitacoes itens={dados.recentes} mostrarAluno={!aluno} />
      </section>
    </>
  );
}

export { TabelaSolicitacoes };
