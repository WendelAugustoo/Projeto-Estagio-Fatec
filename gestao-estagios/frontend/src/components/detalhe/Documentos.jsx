import { useRef, useState } from 'react';
import { api, baixarArquivo } from '../../services/api';
import { useAuth } from '../../services/auth';
import { fmtBytes, fmtDataHora } from '../../services/format';
import { Campo, ErroBox, Modal, Vazio } from '../ui';

const STATUS_DOC = { PENDENTE: 'Pendente de conferência', CONFERIDO: 'Conferido', REJEITADO: 'Rejeitado', SUBSTITUIDO: 'Substituído' };
const RELATORIOS = ['RELATORIO_PARCIAL', 'RELATORIO_FINAL'];

/** RF-04 / RF-05: anexos, versões e conferência pela Secretaria. */
export default function Documentos({ dados, aoAtualizar }) {
  const { dominios } = useAuth();
  const [erro, setErro] = useState(null);
  const [rejeitando, setRejeitando] = useState(null);
  const docs = dados.documentos.filter((d) => !RELATORIOS.includes(d.tipo));
  const vigentes = docs.filter((d) => d.status !== 'SUBSTITUIDO');
  const anteriores = docs.filter((d) => d.status === 'SUBSTITUIDO');
  const p = dados.permissoes;
  const faltantes = dados.documentos_obrigatorios.filter((t) => !vigentes.some((d) => d.tipo === t));

  const baixar = (d) => baixarArquivo(`/documentos/${d.id}/download`, d.nome_arquivo).catch(setErro);
  const conferir = async (d, status, observacao) => {
    setErro(null);
    try {
      await api.patch(`/documentos/${d.id}/conferencia`, { status, observacao });
      setRejeitando(null);
      aoAtualizar(status === 'CONFERIDO' ? 'Documento marcado como conferido.' : 'Documento rejeitado; o aluno verá o motivo.');
    } catch (err) {
      setErro(err);
    }
  };

  return (
    <section className="cartao" aria-labelledby="titulo-docs">
      <h2 id="titulo-docs">Documentos</h2>
      <p className="ajuda">
        Obrigatórios nesta modalidade: {dados.documentos_obrigatorios.map((t) => dominios.tipos_documento[t]).join(' · ')}
      </p>
      {faltantes.length > 0 && (
        <div className="alerta alerta-aviso" role="status">
          Faltando: {faltantes.map((t) => dominios.tipos_documento[t]).join(', ')}.
        </div>
      )}
      <ErroBox erro={erro} />
      {!vigentes.length ? (
        <Vazio>Nenhum documento anexado.</Vazio>
      ) : (
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead>
              <tr>
                <th scope="col">Tipo</th>
                <th scope="col">Arquivo</th>
                <th scope="col">Enviado</th>
                <th scope="col">Situação</th>
                <th scope="col">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {vigentes.map((d) => (
                <tr key={d.id}>
                  <td data-rotulo="Tipo">
                    {dominios.tipos_documento[d.tipo]} <small>v{d.versao}</small>
                  </td>
                  <td data-rotulo="Arquivo">
                    <button type="button" className="link-botao" onClick={() => baixar(d)}>
                      {d.nome_arquivo}
                    </button>{' '}
                    <small>({fmtBytes(d.tamanho_bytes)})</small>
                  </td>
                  <td data-rotulo="Enviado">
                    {fmtDataHora(d.data_envio)}
                    <br />
                    <small>{d.enviado_por_nome}</small>
                  </td>
                  <td data-rotulo="Situação">
                    <span className={`selo-doc doc-${d.status.toLowerCase()}`}>{STATUS_DOC[d.status]}</span>
                    {d.observacao && <small className="bloco">Motivo: {d.observacao}</small>}
                    {d.conferido_por_nome && <small className="bloco">por {d.conferido_por_nome}</small>}
                  </td>
                  <td data-rotulo="Ações" className="celula-acoes">
                    {p.conferir_documentos && d.status !== 'CONFERIDO' && (
                      <button type="button" className="botao botao-pequeno botao-primario" onClick={() => conferir(d, 'CONFERIDO')}>
                        Conferido
                      </button>
                    )}
                    {p.conferir_documentos && d.status !== 'REJEITADO' && (
                      <button type="button" className="botao botao-pequeno botao-secundario" onClick={() => setRejeitando(d)}>
                        Rejeitar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {anteriores.length > 0 && (
        <details className="versoes">
          <summary>Versões anteriores ({anteriores.length})</summary>
          <ul>
            {anteriores.map((d) => (
              <li key={d.id}>
                {dominios.tipos_documento[d.tipo]} v{d.versao} —{' '}
                <button type="button" className="link-botao" onClick={() => baixar(d)}>
                  {d.nome_arquivo}
                </button>{' '}
                — {fmtDataHora(d.data_envio)}
                {d.observacao && <> — motivo da rejeição: {d.observacao}</>}
              </li>
            ))}
          </ul>
        </details>
      )}

      {p.anexar && <FormularioUpload dados={dados} aoEnviar={aoAtualizar} />}

      <ModalRejeicao doc={rejeitando} aoFechar={() => setRejeitando(null)} aoConfirmar={(obs) => conferir(rejeitando, 'REJEITADO', obs)} />
    </section>
  );
}

function ModalRejeicao({ doc, aoFechar, aoConfirmar }) {
  const [obs, setObs] = useState('');
  const { dominios } = useAuth();
  return (
    <Modal titulo="Rejeitar documento" aberto={Boolean(doc)} aoFechar={aoFechar}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          aoConfirmar(obs);
        }}
      >
        <p>{doc && dominios.tipos_documento[doc.tipo]}</p>
        <Campo rotulo="Motivo da rejeição" obrigatorio>
          {(id) => <textarea id={id} rows={3} value={obs} onChange={(e) => setObs(e.target.value)} required />}
        </Campo>
        <div className="acoes-formulario">
          <button type="button" className="botao botao-secundario" onClick={aoFechar}>
            Voltar
          </button>
          <button className="botao botao-perigo" disabled={!obs.trim()}>
            Rejeitar
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FormularioUpload({ dados, aoEnviar }) {
  const { dominios } = useAuth();
  const [tipo, setTipo] = useState('');
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const arquivoRef = useRef(null);

  const enviar = async (e) => {
    e.preventDefault();
    setErro(null);
    const arquivo = arquivoRef.current.files[0];
    if (!tipo || !arquivo) {
      setErro({ message: 'Selecione o tipo de documento e o arquivo.' });
      return;
    }
    if (arquivo.size > 5 * 1024 * 1024) {
      setErro({ message: 'O arquivo excede o limite de 5 MB.' });
      return;
    }
    const fd = new FormData();
    fd.append('tipo', tipo);
    fd.append('arquivo', arquivo);
    setEnviando(true);
    try {
      await api.post(`/solicitacoes/${dados.solicitacao.id}/documentos`, fd);
      arquivoRef.current.value = '';
      setTipo('');
      aoEnviar('Documento anexado.');
    } catch (err) {
      setErro(err);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form className="upload" onSubmit={enviar}>
      <h3>Anexar documento</h3>
      <div className="grade-upload">
        <Campo rotulo="Tipo de documento" obrigatorio>
          {(id) => (
            <select id={id} value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="">Selecione…</option>
              {dados.tipos_documento_permitidos.map((t) => (
                <option key={t} value={t}>
                  {dominios.tipos_documento[t]}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <Campo rotulo="Arquivo (PDF, PNG ou JPG — até 5 MB)" obrigatorio>
          {(id) => <input id={id} type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" ref={arquivoRef} />}
        </Campo>
        <button className="botao botao-primario" disabled={enviando}>
          {enviando ? 'Enviando…' : 'Anexar'}
        </button>
      </div>
      <small className="ajuda">Ao anexar um tipo já existente, a nova versão substitui a anterior, que permanece no histórico. Use apenas documentos fictícios.</small>
      <ErroBox erro={erro} />
    </form>
  );
}
