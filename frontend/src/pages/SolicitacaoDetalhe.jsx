import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, baixarArquivo } from '../services/api';
import { useAuth } from '../services/auth';
import { fmtDataHora, fmtDia } from '../services/format';
import { Carregando, ErroBox, StatusBadge, Sucesso } from '../components/ui';
import Acoes from '../components/detalhe/Acoes';
import Documentos from '../components/detalhe/Documentos';
import Execucao from '../components/detalhe/Execucao';
import Conferencia from '../components/detalhe/Conferencia';
import { Historico, Pareceres } from '../components/detalhe/Historico';

const ETAPAS = {
  REGULAR: ['RASCUNHO', 'ENVIADO', 'EM_CONFERENCIA', 'EM_ANALISE_ACADEMICA', 'AGUARDANDO_ASSINATURA', 'FORMALIZADO', 'EM_EXECUCAO', 'EM_AVALIACAO_FINAL', 'CONCLUIDO'],
  EQUIVALENCIA: ['RASCUNHO', 'ENVIADO', 'EM_CONFERENCIA', 'EM_ANALISE_ACADEMICA', 'DECISAO'],
  EQUIPARACAO: ['RASCUNHO', 'ENVIADO', 'EM_CONFERENCIA', 'EM_ANALISE_ACADEMICA', 'DECISAO'],
};

function Etapas({ sol, historico }) {
  const { dominios } = useAuth();
  const etapas = ETAPAS[sol.modalidade];
  // Durante correção/reenvio, a etapa corrente é a última etapa "normal" registrada no histórico.
  let atual = sol.status;
  if (['AGUARDANDO_CORRECAO', 'REENVIADO'].includes(atual)) {
    const ultima = [...historico].reverse().find((h) => etapas.includes(h.status_anterior) && h.status_novo === 'AGUARDANDO_CORRECAO');
    atual = ultima?.status_anterior || 'EM_CONFERENCIA';
  }
  if (['DEFERIDO', 'DEFERIDO_PARCIAL', 'INDEFERIDO'].includes(atual) && sol.modalidade !== 'REGULAR') atual = 'DECISAO';
  const encerrada = dominios.status_finais.includes(sol.status);
  const idx = etapas.indexOf(atual);
  return (
    <ol className="etapas" aria-label="Etapas do processo">
      {etapas.map((e, i) => {
        const estado = i < idx || (encerrada && i === idx) ? 'feita' : i === idx ? 'atual' : '';
        const rotulo = e === 'DECISAO' ? (encerrada && sol.modalidade !== 'REGULAR' ? dominios.status[sol.status] : 'Decisão') : dominios.status[e];
        return (
          <li key={e} className={estado} aria-current={estado === 'atual' ? 'step' : undefined}>
            <span className="etapa-num">{i + 1}</span>
            <span className="etapa-rotulo">{rotulo}</span>
          </li>
        );
      })}
    </ol>
  );
}

export default function SolicitacaoDetalhe() {
  const { id } = useParams();
  const local = useLocation();
  const navigate = useNavigate();
  const { dominios } = useAuth();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [mensagem, setMensagem] = useState(local.state?.mensagem || '');

  const carregar = useCallback(async () => {
    try {
      setDados(await api.get(`/solicitacoes/${id}`));
      setErro(null);
    } catch (err) {
      setErro(err);
    }
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (local.state?.mensagem) navigate(local.pathname, { replace: true, state: null });
  }, [local, navigate]);

  const atualizar = (msg) => {
    setMensagem(msg);
    carregar();
  };

  if (erro && !dados) {
    return (
      <>
        <ErroBox erro={erro} titulo={erro.status === 404 ? 'Solicitação não encontrada ou sem permissão de acesso.' : undefined} />
        <Link to="/solicitacoes">← Voltar</Link>
      </>
    );
  }
  if (!dados) return <Carregando />;

  const s = dados.solicitacao;
  const p = dados.plano;
  const regular = s.modalidade === 'REGULAR';
  const mostraExecucao = regular && (['EM_EXECUCAO', 'EM_AVALIACAO_FINAL', 'CONCLUIDO'].includes(s.status) || dados.horas.length > 0 || dados.relatorios.length > 0);

  return (
    <>
      <nav className="migalhas" aria-label="Você está em">
        <Link to="/solicitacoes">Solicitações</Link> <span aria-hidden="true">›</span> {s.protocolo || `Rascunho #${s.id}`}
      </nav>
      <div className="cabecalho-pagina">
        <div>
          <h1>
            {s.protocolo || `Rascunho #${s.id}`} <StatusBadge status={s.status} />
          </h1>
          <p className="subtitulo">
            {dominios.modalidades[s.modalidade]} · {s.aluno_nome} ({s.matricula}) · {s.curso_nome}
          </p>
        </div>
        <div className="botoes-cabecalho">
          {dados.permissoes.editar && (
            <Link className="botao botao-secundario" to={`/solicitacoes/${s.id}/editar`}>
              Editar dados
            </Link>
          )}
          <button type="button" className="botao botao-secundario" onClick={() => baixarArquivo(`/solicitacoes/${s.id}/pdf`, 'solicitacao.pdf').catch(setErro)}>
            Exportar PDF
          </button>
        </div>
      </div>

      <Etapas sol={s} historico={dados.historico} />
      <Sucesso>{mensagem}</Sucesso>
      <ErroBox erro={erro} />

      {dados.pendencias.length > 0 && (
        <section className="alerta alerta-aviso" aria-labelledby="titulo-pend">
          <strong id="titulo-pend">Pendências</strong>
          <ul>
            {dados.pendencias.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
      )}

      <Acoes dados={dados} aoConcluir={atualizar} />

      <div className="grade-detalhe">
        <div className="coluna-principal">
          <section className="cartao" aria-labelledby="titulo-dados">
            <h2 id="titulo-dados">{regular ? 'Dados do estágio e PAE' : 'Dados da solicitação'}</h2>
            <dl className="dados">
              {regular && (
                <>
                  <dt>Concedente</dt>
                  <dd>
                    {s.concedente_nome || '—'}
                    {s.concedente_identificador && <small className="bloco">{s.concedente_identificador} · convênio: {s.concedente_convenio === 'DECLARADO_VIGENTE' ? 'declarado vigente' : s.concedente_convenio === 'SEM_CONVENIO' ? 'sem convênio' : 'não verificado'} (validação humana)</small>}
                  </dd>
                </>
              )}
              {s.empresa_vinculo && (
                <>
                  <dt>Empresa / vínculo</dt>
                  <dd>{s.empresa_vinculo}</dd>
                </>
              )}
              {s.tipo_atividade && (
                <>
                  <dt>Atividade acadêmica</dt>
                  <dd>
                    {dominios.tipos_atividade[s.tipo_atividade]} — orientador(a): {s.orientador_nome}
                  </dd>
                </>
              )}
              <dt>Período</dt>
              <dd>
                {fmtDia(p.periodo_inicio)} a {fmtDia(p.periodo_fim)}
              </dd>
              <dt>{regular ? 'Carga horária prevista' : 'Carga horária solicitada'}</dt>
              <dd>{p.horas_previstas ? `${p.horas_previstas}h` : '—'}</dd>
              {s.horas_reconhecidas !== null && s.horas_reconhecidas !== undefined && (
                <>
                  <dt>Horas reconhecidas</dt>
                  <dd>
                    <strong>{s.horas_reconhecidas}h</strong>
                  </dd>
                </>
              )}
              <dt>Descrição das atividades</dt>
              <dd className="pre">{p.descricao || '—'}</dd>
              {regular && (
                <>
                  <dt>Técnicas</dt>
                  <dd className="pre">{p.tecnicas || '—'}</dd>
                  <dt>Compatibilidade com o curso</dt>
                  <dd className="pre">{p.compatibilidade || '—'}</dd>
                </>
              )}
              <dt>Professor responsável</dt>
              <dd>{s.professor_nome || 'a definir pela Secretaria'}</dd>
              <dt>Criada / enviada</dt>
              <dd>
                {fmtDataHora(s.criada_em)} / {fmtDataHora(s.enviada_em)}
              </dd>
            </dl>
          </section>

          <Documentos dados={dados} aoAtualizar={atualizar} />
          {regular && s.status !== 'RASCUNHO' && <Conferencia key={s.atualizada_em} dados={dados} aoAtualizar={atualizar} />}
          {mostraExecucao && <Execucao dados={dados} aoAtualizar={atualizar} />}
        </div>
        <div className="coluna-lateral">
          <Pareceres pareceres={dados.pareceres} />
          <Historico historico={dados.historico} />
        </div>
      </div>
    </>
  );
}
