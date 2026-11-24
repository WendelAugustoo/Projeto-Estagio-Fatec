import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../services/auth';
import { Campo, Carregando, ErroBox } from '../components/ui';

const PLANO_VAZIO = { descricao: '', tecnicas: '', compatibilidade: '', periodo_inicio: '', periodo_fim: '', horas_previstas: '' };

/** RF-03: criar e editar solicitação (o envio é feito na tela de detalhe, após anexar documentos). */
export default function SolicitacaoForm() {
  const { id } = useParams();
  const editando = Boolean(id);
  const navigate = useNavigate();
  const { usuario, dominios } = useAuth();
  const [concedentes, setConcedentes] = useState([]);
  const [form, setForm] = useState({ modalidade: '', concedente_id: '', tipo_atividade: '', orientador_nome: '', empresa_vinculo: '', plano: PLANO_VAZIO });
  const [carregando, setCarregando] = useState(editando);
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api.get('/concedentes').then(setConcedentes).catch(setErro);
    if (editando) {
      api
        .get(`/solicitacoes/${id}`)
        .then((d) => {
          if (!d.permissoes.editar) {
            navigate(`/solicitacoes/${id}`, { replace: true });
            return;
          }
          const s = d.solicitacao;
          const p = d.plano;
          setForm({
            modalidade: s.modalidade,
            concedente_id: s.concedente_id || '',
            tipo_atividade: s.tipo_atividade || '',
            orientador_nome: s.orientador_nome || '',
            empresa_vinculo: s.empresa_vinculo || '',
            plano: {
              descricao: p.descricao || '',
              tecnicas: p.tecnicas || '',
              compatibilidade: p.compatibilidade || '',
              periodo_inicio: p.periodo_inicio || '',
              periodo_fim: p.periodo_fim || '',
              horas_previstas: p.horas_previstas ?? '',
            },
          });
        })
        .catch(setErro)
        .finally(() => setCarregando(false));
    }
  }, [editando, id, navigate]);

  const set = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });
  const setPlano = (campo) => (e) => setForm({ ...form, plano: { ...form.plano, [campo]: e.target.value } });

  const salvar = async (e) => {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const corpo = { ...form, concedente_id: form.concedente_id || null };
      const res = editando ? await api.put(`/solicitacoes/${id}`, corpo) : await api.post('/solicitacoes', corpo);
      navigate(`/solicitacoes/${res.id}`, { state: { mensagem: editando ? 'Alterações salvas.' : 'Rascunho criado. Agora anexe os documentos e envie para conferência.' } });
    } catch (err) {
      setErro(err);
      setSalvando(false);
    }
  };

  if (carregando) return <Carregando />;
  const m = form.modalidade;
  const equiparacaoSemPpc = m === 'EQUIPARACAO' && usuario.aluno && !usuario.aluno.permite_equiparacao;

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>{editando ? 'Editar solicitação' : 'Nova solicitação'}</h1>
          <p className="subtitulo">
            Curso: <strong>{usuario.aluno?.curso_nome}</strong>. Campos com * são exigidos para o envio; você pode salvar o rascunho incompleto.
          </p>
        </div>
      </div>

      <form className="cartao formulario" onSubmit={salvar} noValidate>
        <fieldset disabled={editando}>
          <legend>Modalidade *</legend>
          <div className="opcoes-modalidade">
            {Object.entries(dominios.modalidades).map(([k, v]) => (
              <label key={k} className={`opcao ${m === k ? 'selecionada' : ''}`}>
                <input type="radio" name="modalidade" value={k} checked={m === k} onChange={set('modalidade')} />
                <span>
                  <strong>{v}</strong>
                  <small>
                    {k === 'REGULAR' && 'Estágio em empresa concedente, com TCE e PAE.'}
                    {k === 'EQUIVALENCIA' && 'Reconhecimento de experiência profissional relacionada ao curso.'}
                    {k === 'EQUIPARACAO' && 'Iniciação científica, monitoria, pesquisa ou extensão (se prevista no PPC).'}
                  </small>
                </span>
              </label>
            ))}
          </div>
          {editando && <small className="ajuda">A modalidade não pode ser alterada após a criação.</small>}
        </fieldset>

        {equiparacaoSemPpc && (
          <div className="alerta alerta-aviso" role="status">
            O PPC do seu curso não prevê equiparação de atividades acadêmicas. A solicitação pode ser registrada, mas não poderá ser deferida automaticamente (RN-12).
          </div>
        )}
        {m === 'REGULAR' && usuario.aluno?.situacao_matricula === 'IRREGULAR' && (
          <div className="alerta alerta-aviso" role="status">
            Sua matrícula consta como irregular: o envio do estágio regular ficará bloqueado até a regularização (RN-01).
          </div>
        )}

        {m && (
          <>
            {m === 'REGULAR' && (
              <Campo rotulo="Empresa concedente" obrigatorio ajuda="Não encontrou a empresa? Solicite o cadastro à Secretaria.">
                {(cid) => (
                  <select id={cid} value={form.concedente_id} onChange={set('concedente_id')}>
                    <option value="">Selecione…</option>
                    {concedentes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.razao_social}
                      </option>
                    ))}
                  </select>
                )}
              </Campo>
            )}
            {m === 'EQUIVALENCIA' && (
              <Campo rotulo="Empresa / empregador e função" obrigatorio>
                {(cid) => <input id={cid} value={form.empresa_vinculo} onChange={set('empresa_vinculo')} maxLength={200} />}
              </Campo>
            )}
            {m === 'EQUIPARACAO' && (
              <div className="grade-2">
                <Campo rotulo="Tipo de atividade acadêmica" obrigatorio>
                  {(cid) => (
                    <select id={cid} value={form.tipo_atividade} onChange={set('tipo_atividade')}>
                      <option value="">Selecione…</option>
                      {Object.entries(dominios.tipos_atividade).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  )}
                </Campo>
                <Campo rotulo="Professor orientador" obrigatorio>
                  {(cid) => <input id={cid} value={form.orientador_nome} onChange={set('orientador_nome')} maxLength={200} />}
                </Campo>
              </div>
            )}

            <fieldset>
              <legend>{m === 'REGULAR' ? 'Plano de Atividades de Estágio (PAE)' : 'Atividades e carga horária'}</legend>
              <Campo rotulo={m === 'EQUIVALENCIA' ? 'Descrição técnica das atividades profissionais' : 'Descrição das atividades'} obrigatorio>
                {(cid) => <textarea id={cid} rows={4} value={form.plano.descricao} onChange={setPlano('descricao')} />}
              </Campo>
              {m === 'REGULAR' && (
                <>
                  <Campo rotulo="Técnicas, ferramentas e tecnologias" obrigatorio>
                    {(cid) => <textarea id={cid} rows={2} value={form.plano.tecnicas} onChange={setPlano('tecnicas')} />}
                  </Campo>
                  <Campo rotulo="Compatibilidade com o curso" obrigatorio ajuda="Explique como as atividades se relacionam com as disciplinas do curso (RN-05).">
                    {(cid) => <textarea id={cid} rows={2} value={form.plano.compatibilidade} onChange={setPlano('compatibilidade')} />}
                  </Campo>
                </>
              )}
              <div className="grade-3">
                <Campo rotulo="Início do período" obrigatorio={m !== 'EQUIPARACAO'}>
                  {(cid) => <input id={cid} type="date" value={form.plano.periodo_inicio} onChange={setPlano('periodo_inicio')} />}
                </Campo>
                <Campo rotulo="Fim do período" obrigatorio={m === 'REGULAR'}>
                  {(cid) => <input id={cid} type="date" value={form.plano.periodo_fim} onChange={setPlano('periodo_fim')} />}
                </Campo>
                <Campo rotulo={m === 'REGULAR' ? 'Carga horária prevista (h)' : 'Carga horária solicitada (h)'} obrigatorio>
                  {(cid) => <input id={cid} type="number" min="1" max="10000" value={form.plano.horas_previstas} onChange={setPlano('horas_previstas')} />}
                </Campo>
              </div>
            </fieldset>
          </>
        )}

        <ErroBox erro={erro} />
        <div className="acoes-formulario">
          <Link to={editando ? `/solicitacoes/${id}` : '/solicitacoes'} className="botao botao-secundario">
            Cancelar
          </Link>
          <button className="botao botao-primario" disabled={!m || salvando}>
            {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Salvar rascunho e anexar documentos'}
          </button>
        </div>
      </form>
    </>
  );
}
