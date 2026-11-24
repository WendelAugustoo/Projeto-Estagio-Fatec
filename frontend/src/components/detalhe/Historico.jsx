import { useAuth } from '../../services/auth';
import { fmtDataHora, PERFIL_ROTULO, RESULTADO_ROTULO, TIPO_PARECER_ROTULO } from '../../services/format';
import { Vazio } from '../ui';

/** CA-11: linha do tempo com ator, data, motivo e transição. */
export function Historico({ historico }) {
  const { dominios } = useAuth();
  return (
    <section className="cartao" aria-labelledby="titulo-hist">
      <h2 id="titulo-hist">Histórico</h2>
      <ol className="linha-tempo">
        {[...historico].reverse().map((h) => (
          <li key={h.id}>
            <div className="lt-cabecalho">
              <strong>
                {h.status_anterior ? `${dominios.status[h.status_anterior]} → ` : ''}
                {dominios.status[h.status_novo]}
              </strong>
              <time dateTime={h.data_hora}>{fmtDataHora(h.data_hora)}</time>
            </div>
            <div className="lt-autor">
              {h.autor_nome} · {PERFIL_ROTULO[h.autor_perfil]}
            </div>
            {h.motivo && <p className="lt-motivo">{h.motivo}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Pareceres({ pareceres }) {
  return (
    <section className="cartao" aria-labelledby="titulo-par">
      <h2 id="titulo-par">Pareceres</h2>
      {!pareceres.length ? (
        <Vazio>Nenhum parecer registrado.</Vazio>
      ) : (
        <ul className="lista-pareceres">
          {[...pareceres].reverse().map((p) => (
            <li key={p.id}>
              <div className="lt-cabecalho">
                <strong>
                  {TIPO_PARECER_ROTULO[p.tipo]} — {RESULTADO_ROTULO[p.resultado] || p.resultado}
                </strong>
                <time dateTime={p.data}>{fmtDataHora(p.data)}</time>
              </div>
              <div className="lt-autor">
                {p.avaliador_nome} · {PERFIL_ROTULO[p.avaliador_perfil]}
                {p.horas_sugeridas !== null && p.horas_sugeridas !== undefined && <> · {p.horas_sugeridas}h</>}
              </div>
              <p className="lt-motivo">{p.justificativa}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
