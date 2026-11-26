import { useRef, useState } from 'react';
import { api, baixarArquivo } from '../../services/api';
import { fmtDataHora, fmtDia } from '../../services/format';
import { Campo, ErroBox, Modal, Vazio } from '../ui';

const VALIDACAO = { PENDENTE: 'Pendente', VALIDADO: 'Validado', RECUSADO: 'Recusado' };
const AVALIACAO = { PENDENTE: 'Aguardando avaliação', APROVADO: 'Aprovado', DEVOLVIDO: 'Devolvido', SUBSTITUIDO: 'Substituído' };

/** RF-08: execução do estágio — horas e relatórios parciais/final. */
export default function Execucao({ dados, aoAtualizar }) {
  const { resumo_horas: r, permissoes: p } = dados;
  const [erro, setErro] = useState(null);
  const [recusa, setRecusa] = useState(null); // { tipo: 'hora'|'relatorio', item }
  const pct = r.previstas ? Math.min(100, Math.round((r.validadas / r.previstas) * 100)) : 0;

  const validarHora = async (h, validado, observacao) => {
    setErro(null);
    try {
      await api.patch(`/horas/${h.id}/validacao`, { validado, observacao });
      setRecusa(null);
      aoAtualizar(validado === 'VALIDADO' ? 'Horas validadas.' : 'Registro de horas recusado.');
    } catch (err) {
      setErro(err);
    }
  };
  const avaliarRelatorio = async (rel, estado, observacao) => {
    setErro(null);
    try {
      await api.patch(`/relatorios/${rel.id}/avaliacao`, { estado, observacao });
      setRecusa(null);
      aoAtualizar(estado === 'APROVADO' ? 'Relatório aprovado.' : 'Relatório devolvido ao aluno.');
    } catch (err) {
      setErro(err);
    }
  };

  return (
    <section className="cartao" aria-labelledby="titulo-exec">
      <h2 id="titulo-exec">Execução do estágio</h2>
      <div className="progresso-horas">
        <div className="progresso-rotulo">
          <span>
            Horas validadas: <strong>{r.validadas}h</strong> de {r.previstas}h previstas
          </span>
          <span>Registradas: {r.registradas}h</span>
        </div>
        <div className="progresso" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Percentual de horas validadas">
          <div style={{ width: `${pct}%` }} />
        </div>
        {r.parciais_exigidos > 0 && <small className="ajuda">Este período exige {r.parciais_exigidos} relatório(s) parcial(is) — intervalo máximo de seis meses.</small>}
      </div>
      <ErroBox erro={erro} />

      <h3>Registros de horas</h3>
      {!dados.horas.length ? (
        <Vazio>Nenhuma hora registrada.</Vazio>
      ) : (
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">Horas</th>
                <th scope="col">Atividade</th>
                <th scope="col">Validação</th>
                {p.validar_horas && (
                  <th scope="col">
                    <span className="sr-only">Ações</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {dados.horas.map((h) => (
                <tr key={h.id}>
                  <td data-rotulo="Data">{fmtDia(h.data)}</td>
                  <td data-rotulo="Horas">{h.horas}h</td>
                  <td data-rotulo="Atividade">{h.descricao}</td>
                  <td data-rotulo="Validação">
                    <span className={`selo-doc doc-${h.validado === 'VALIDADO' ? 'conferido' : h.validado === 'RECUSADO' ? 'rejeitado' : 'pendente'}`}>{VALIDACAO[h.validado]}</span>
                    {h.observacao && <small className="bloco">{h.observacao}</small>}
                  </td>
                  {p.validar_horas && (
                    <td data-rotulo="Ações" className="celula-acoes">
                      {h.validado === 'PENDENTE' && (
                        <>
                          <button type="button" className="botao botao-pequeno botao-primario" onClick={() => validarHora(h, 'VALIDADO')}>
                            Validar
                          </button>
                          <button type="button" className="botao botao-pequeno botao-secundario" onClick={() => setRecusa({ tipo: 'hora', item: h })}>
                            Recusar
                          </button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {p.registrar_horas && <FormHoras dados={dados} aoEnviar={aoAtualizar} />}

      <h3>Relatórios</h3>
      {!dados.relatorios.length ? (
        <Vazio>Nenhum relatório enviado.</Vazio>
      ) : (
        <ul className="lista-relatorios">
          {dados.relatorios.map((rel) => (
            <li key={rel.id} className={rel.estado_avaliacao === 'SUBSTITUIDO' ? 'esmaecido' : ''}>
              <div>
                <strong>Relatório {rel.tipo === 'FINAL' ? 'final' : 'parcial'}</strong> — {rel.periodo}
                <br />
                <button type="button" className="link-botao" onClick={() => baixarArquivo(`/documentos/${rel.arquivo_id}/download`, rel.nome_arquivo).catch(setErro)}>
                  {rel.nome_arquivo}
                </button>{' '}
                <small>enviado em {fmtDataHora(rel.enviado_em)}</small>
                {rel.observacao && <small className="bloco">Observação: {rel.observacao}</small>}
              </div>
              <div className="celula-acoes">
                <span className={`selo-doc doc-${rel.estado_avaliacao === 'APROVADO' ? 'conferido' : rel.estado_avaliacao === 'DEVOLVIDO' ? 'rejeitado' : rel.estado_avaliacao === 'SUBSTITUIDO' ? 'substituido' : 'pendente'}`}>
                  {AVALIACAO[rel.estado_avaliacao]}
                </span>
                {p.avaliar_relatorio && rel.estado_avaliacao === 'PENDENTE' && (
                  <>
                    <button type="button" className="botao botao-pequeno botao-primario" onClick={() => avaliarRelatorio(rel, 'APROVADO')}>
                      Aprovar
                    </button>
                    <button type="button" className="botao botao-pequeno botao-secundario" onClick={() => setRecusa({ tipo: 'relatorio', item: rel })}>
                      Devolver
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {p.enviar_relatorio && <FormRelatorio dados={dados} aoEnviar={aoAtualizar} />}

      <ModalMotivo
        aberto={Boolean(recusa)}
        titulo={recusa?.tipo === 'hora' ? 'Recusar registro de horas' : 'Devolver relatório'}
        aoFechar={() => setRecusa(null)}
        aoConfirmar={(obs) => (recusa.tipo === 'hora' ? validarHora(recusa.item, 'RECUSADO', obs) : avaliarRelatorio(recusa.item, 'DEVOLVIDO', obs))}
        aviso={recusa?.tipo === 'relatorio' && recusa.item.tipo === 'FINAL' && dados.solicitacao.status === 'EM_AVALIACAO_FINAL' ? 'A solicitação voltará para “Aguardando correção” e a conclusão ficará bloqueada até a nova versão.' : null}
      />
    </section>
  );
}

function ModalMotivo({ aberto, titulo, aoFechar, aoConfirmar, aviso }) {
  const [obs, setObs] = useState('');
  return (
    <Modal titulo={titulo} aberto={aberto} aoFechar={aoFechar}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          aoConfirmar(obs);
          setObs('');
        }}
      >
        {aviso && <div className="alerta alerta-aviso">{aviso}</div>}
        <Campo rotulo="Motivo" obrigatorio>
          {(id) => <textarea id={id} rows={3} value={obs} onChange={(e) => setObs(e.target.value)} required />}
        </Campo>
        <div className="acoes-formulario">
          <button type="button" className="botao botao-secundario" onClick={aoFechar}>
            Voltar
          </button>
          <button className="botao botao-perigo" disabled={!obs.trim()}>
            Confirmar
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FormHoras({ dados, aoEnviar }) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ data: hoje, horas: '', descricao: '' });
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const enviar = async (e) => {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await api.post(`/solicitacoes/${dados.solicitacao.id}/horas`, form);
      setForm({ data: hoje, horas: '', descricao: '' });
      aoEnviar('Horas registradas; aguardando validação do professor.');
    } catch (err) {
      setErro(err);
    } finally {
      setEnviando(false);
    }
  };
  return (
    <form className="upload" onSubmit={enviar}>
      <h4>Registrar horas</h4>
      <div className="grade-horas">
        <Campo rotulo="Data" obrigatorio>
          {(id) => <input id={id} type="date" min={dados.plano.periodo_inicio || undefined} max={hoje} value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />}
        </Campo>
        <Campo rotulo="Horas" obrigatorio>
          {(id) => <input id={id} type="number" step="0.5" min="0.5" max="12" value={form.horas} onChange={(e) => setForm({ ...form, horas: e.target.value })} />}
        </Campo>
        <Campo rotulo="Atividade realizada" obrigatorio>
          {(id) => <input id={id} value={form.descricao} maxLength={1000} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />}
        </Campo>
        <button className="botao botao-primario" disabled={enviando}>
          Registrar
        </button>
      </div>
      <ErroBox erro={erro} />
    </form>
  );
}

function FormRelatorio({ dados, aoEnviar }) {
  const somenteFinal = dados.solicitacao.status === 'AGUARDANDO_CORRECAO';
  const [tipo, setTipo] = useState(somenteFinal ? 'FINAL' : 'PARCIAL');
  const [periodo, setPeriodo] = useState('');
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const ref = useRef(null);
  const enviar = async (e) => {
    e.preventDefault();
    setErro(null);
    const arquivo = ref.current.files[0];
    if (!arquivo || !periodo.trim()) {
      setErro({ message: 'Informe o período de referência e selecione o arquivo.' });
      return;
    }
    const fd = new FormData();
    fd.append('tipo', tipo);
    fd.append('periodo', periodo);
    fd.append('arquivo', arquivo);
    setEnviando(true);
    try {
      await api.post(`/solicitacoes/${dados.solicitacao.id}/relatorios`, fd);
      ref.current.value = '';
      setPeriodo('');
      aoEnviar('Relatório enviado para avaliação do professor.');
    } catch (err) {
      setErro(err);
    } finally {
      setEnviando(false);
    }
  };
  return (
    <form className="upload" onSubmit={enviar}>
      <h4>{somenteFinal ? 'Enviar nova versão do relatório final' : 'Enviar relatório'}</h4>
      <div className="grade-upload">
        <Campo rotulo="Tipo" obrigatorio>
          {(id) => (
            <select id={id} value={tipo} onChange={(e) => setTipo(e.target.value)} disabled={somenteFinal}>
              <option value="PARCIAL">Parcial</option>
              <option value="FINAL">Final</option>
            </select>
          )}
        </Campo>
        <Campo rotulo="Período de referência" obrigatorio>
          {(id) => <input id={id} value={periodo} maxLength={100} placeholder="ex.: 1º trimestre" onChange={(e) => setPeriodo(e.target.value)} />}
        </Campo>
        <Campo rotulo="Arquivo (PDF, PNG ou JPG)" obrigatorio>
          {(id) => <input id={id} type="file" accept=".pdf,.png,.jpg,.jpeg" ref={ref} />}
        </Campo>
        <button className="botao botao-primario" disabled={enviando}>
          Enviar
        </button>
      </div>
      <ErroBox erro={erro} />
    </form>
  );
}
