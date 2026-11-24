import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../services/auth';
import { Campo, ErroBox, Modal } from '../ui';

/**
 * Painel de ações do workflow. As ações e seus bloqueios vêm do backend;
 * a interface apenas apresenta — o servidor revalida tudo ao executar.
 */
export default function Acoes({ dados, aoConcluir }) {
  const { dominios } = useAuth();
  const [selecionada, setSelecionada] = useState(null);
  const acoes = dados.acoes;
  if (!acoes.length) return null;

  return (
    <section className="cartao cartao-acoes" aria-labelledby="titulo-acoes">
      <h2 id="titulo-acoes">Ações disponíveis</h2>
      <div className="lista-acoes">
        {acoes.map((a) => (
          <div key={a.acao} className="acao-item">
            <button
              type="button"
              className={`botao ${a.perigo ? 'botao-perigo' : a.bloqueios.length || a.secundaria ? 'botao-secundario' : 'botao-primario'}`}
              disabled={a.bloqueios.length > 0}
              aria-describedby={a.bloqueios.length ? `bloq-${a.acao}` : undefined}
              onClick={() => setSelecionada(a)}
            >
              {a.rotulo}
            </button>
            {a.destino && !a.bloqueios.length && <small className="ajuda">Próxima situação: {dominios.status[a.destino]}</small>}
            {a.bloqueios.length > 0 && (
              <div id={`bloq-${a.acao}`} className="bloqueios">
                <strong>Bloqueado por:</strong>
                <ul>
                  {a.bloqueios.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
      {selecionada && (
        <DialogoAcao
          acao={selecionada}
          dados={dados}
          aoFechar={() => setSelecionada(null)}
          aoConcluir={(msg) => {
            setSelecionada(null);
            aoConcluir(msg);
          }}
        />
      )}
    </section>
  );
}

function DialogoAcao({ acao, dados, aoFechar, aoConcluir }) {
  const [form, setForm] = useState({ motivo: '', professor_id: dados.solicitacao.professor_id || '', resultado: '', horas_sugeridas: '', horas_reconhecidas: '' });
  const [professores, setProfessores] = useState([]);
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const fechar = useCallback(() => !enviando && aoFechar(), [enviando, aoFechar]);
  const campos = acao.campos || [];
  const solicitadas = dados.plano.horas_previstas;

  useEffect(() => {
    if (campos.includes('professor_id')) api.get('/professores').then(setProfessores).catch(setErro);
  }, [campos]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const executar = async (e) => {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await api.post(`/solicitacoes/${dados.solicitacao.id}/acoes/${acao.acao}`, form);
      aoConcluir(`Ação registrada: ${acao.rotulo}.`);
    } catch (err) {
      setErro(err);
      setEnviando(false);
    }
  };

  return (
    <Modal titulo={acao.rotulo} aberto aoFechar={fechar}>
      <form onSubmit={executar}>
        {campos.includes('professor_id') && (
          <Campo rotulo="Professor responsável pela análise" obrigatorio>
            {(id) => (
              <select id={id} value={form.professor_id} onChange={set('professor_id')} required>
                <option value="">Selecione…</option>
                {professores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            )}
          </Campo>
        )}
        {campos.includes('resultado_tecnico') && (
          <fieldset className="radios">
            <legend>Resultado do parecer *</legend>
            {[
              ['FAVORAVEL', 'Favorável'],
              ['DESFAVORAVEL', 'Desfavorável'],
            ].map(([v, r]) => (
              <label key={v}>
                <input type="radio" name="resultado" value={v} checked={form.resultado === v} onChange={set('resultado')} /> {r}
              </label>
            ))}
            <small className="ajuda">Para solicitar adequações ao aluno, use a ação “Devolver para correção”.</small>
          </fieldset>
        )}
        {campos.includes('horas_sugeridas') && (
          <Campo rotulo={`Horas sugeridas para reconhecimento (solicitadas: ${solicitadas}h)`}>
            {(id) => <input id={id} type="number" min="0" value={form.horas_sugeridas} onChange={set('horas_sugeridas')} />}
          </Campo>
        )}
        {campos.includes('resultado_decisao') && (
          <fieldset className="radios">
            <legend>Decisão *</legend>
            {[
              ['DEFERIDO', `Deferido integralmente (${solicitadas}h)`],
              ['DEFERIDO_PARCIAL', 'Deferido parcialmente'],
              ['INDEFERIDO', 'Indeferido'],
            ].map(([v, r]) => (
              <label key={v}>
                <input type="radio" name="resultado" value={v} checked={form.resultado === v} onChange={set('resultado')} /> {r}
              </label>
            ))}
          </fieldset>
        )}
        {campos.includes('horas_reconhecidas') && form.resultado === 'DEFERIDO_PARCIAL' && (
          <Campo rotulo="Horas reconhecidas" obrigatorio ajuda={`Deve ser menor que as ${solicitadas}h solicitadas.`}>
            {(id) => <input id={id} type="number" min="1" max={solicitadas - 1} value={form.horas_reconhecidas} onChange={set('horas_reconhecidas')} required />}
          </Campo>
        )}
        {acao.motivo && (
          <Campo rotulo={acao.rotuloMotivo} obrigatorio={acao.motivo === 'obrigatorio'}>
            {(id) => <textarea id={id} rows={4} maxLength={2000} value={form.motivo} onChange={set('motivo')} required={acao.motivo === 'obrigatorio'} />}
          </Campo>
        )}
        {!acao.motivo && !campos.length && <p>Confirma a ação “{acao.rotulo}”?</p>}
        <ErroBox erro={erro} />
        <div className="acoes-formulario">
          <button type="button" className="botao botao-secundario" onClick={fechar}>
            Voltar
          </button>
          <button className={`botao ${acao.perigo ? 'botao-perigo' : 'botao-primario'}`} disabled={enviando}>
            {enviando ? 'Registrando…' : 'Confirmar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
