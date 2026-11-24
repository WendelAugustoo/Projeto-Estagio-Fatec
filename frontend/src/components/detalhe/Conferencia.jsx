import { useState } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../services/auth';
import { Campo, ErroBox } from '../ui';

/** RN-03 / RN-07 / RN-08: seguro e vias assinadas do TCE (registro pela Secretaria). */
export default function Conferencia({ dados, aoAtualizar }) {
  const { dominios } = useAuth();
  const s = dados.solicitacao;
  const editavel = dados.permissoes.editar_conferencia;
  const [form, setForm] = useState({
    seguro_situacao: s.seguro_situacao,
    seguro_responsavel: s.seguro_responsavel || '',
    seguro_apolice: s.seguro_apolice || '',
    ass_aluno: Boolean(s.ass_aluno),
    ass_concedente: Boolean(s.ass_concedente),
  });
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const salvar = async (e) => {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      await api.patch(`/solicitacoes/${s.id}/conferencia`, form);
      aoAtualizar('Dados de conferência salvos.');
    } catch (err) {
      setErro(err);
    } finally {
      setSalvando(false);
    }
  };

  const assinaturas = [
    ['Aluno', s.ass_aluno],
    ['Concedente', s.ass_concedente],
    ['Coordenação', s.ass_coordenacao],
    ['Direção', s.ass_direcao],
  ];

  return (
    <section className="cartao" aria-labelledby="titulo-conf">
      <h2 id="titulo-conf">Formalização do TCE</h2>
      <p className="ajuda">Registro acadêmico das etapas de assinatura — sem valor de assinatura oficial. A Direção assina por último (RN-07).</p>
      <ol className="assinaturas">
        {assinaturas.map(([nome, ok]) => (
          <li key={nome} className={ok ? 'ok' : ''}>
            <span aria-hidden="true">{ok ? '✓' : '○'}</span> {nome}
            <span className="sr-only">{ok ? ': registrada' : ': pendente'}</span>
          </li>
        ))}
      </ol>
      {!editavel ? (
        <dl className="dados">
          <dt>Seguro contra acidentes pessoais</dt>
          <dd>{dominios.seguro[s.seguro_situacao]}</dd>
          {s.seguro_responsavel && (
            <>
              <dt>Responsável pela contratação</dt>
              <dd>{s.seguro_responsavel}</dd>
            </>
          )}
          {s.seguro_apolice && (
            <>
              <dt>Apólice</dt>
              <dd>{s.seguro_apolice}</dd>
            </>
          )}
        </dl>
      ) : (
        <form onSubmit={salvar}>
          <div className="grade-3">
            <Campo rotulo="Situação do seguro" obrigatorio>
              {(id) => (
                <select id={id} value={form.seguro_situacao} onChange={(e) => setForm({ ...form, seguro_situacao: e.target.value })}>
                  {Object.entries(dominios.seguro).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
            <Campo rotulo="Responsável pela contratação">
              {(id) => <input id={id} value={form.seguro_responsavel} onChange={(e) => setForm({ ...form, seguro_responsavel: e.target.value })} />}
            </Campo>
            <Campo rotulo="Nº da apólice">
              {(id) => <input id={id} value={form.seguro_apolice} onChange={(e) => setForm({ ...form, seguro_apolice: e.target.value })} />}
            </Campo>
          </div>
          <fieldset className="radios">
            <legend>Vias do TCE conferidas</legend>
            <label>
              <input type="checkbox" checked={form.ass_aluno} onChange={(e) => setForm({ ...form, ass_aluno: e.target.checked })} /> Assinada pelo aluno
            </label>
            <label>
              <input type="checkbox" checked={form.ass_concedente} onChange={(e) => setForm({ ...form, ass_concedente: e.target.checked })} /> Assinada pela concedente
            </label>
          </fieldset>
          <ErroBox erro={erro} />
          <button className="botao botao-primario" disabled={salvando}>
            Salvar conferência
          </button>
        </form>
      )}
    </section>
  );
}
