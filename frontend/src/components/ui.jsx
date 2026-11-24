import { useEffect, useId, useRef } from 'react';
import { useAuth } from '../services/auth';
import { corStatus } from '../services/format';

export function StatusBadge({ status }) {
  const { dominios } = useAuth();
  return <span className={`selo selo-${corStatus(status)}`}>{dominios?.status[status] || status}</span>;
}

/** Mensagem de erro acessível, com lista de pendências de regra quando houver. */
export function ErroBox({ erro, titulo }) {
  if (!erro) return null;
  return (
    <div className="alerta alerta-erro" role="alert">
      <strong>{titulo || erro.message}</strong>
      {titulo && <div>{erro.message}</div>}
      {erro.details?.length > 0 && (
        <ul>
          {erro.details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Sucesso({ children }) {
  if (!children) return null;
  return (
    <div className="alerta alerta-sucesso" role="status">
      {children}
    </div>
  );
}

export function Carregando({ texto = 'Carregando…' }) {
  return (
    <p className="carregando" role="status" aria-live="polite">
      {texto}
    </p>
  );
}

/** Campo de formulário com rótulo associado (RNF-04). */
export function Campo({ rotulo, ajuda, obrigatorio, children, id: idExterno }) {
  const idGerado = useId();
  const id = idExterno || idGerado;
  const filho = typeof children === 'function' ? children(id) : children;
  return (
    <div className="campo">
      <label htmlFor={id}>
        {rotulo}
        {obrigatorio && <span aria-hidden="true" className="obrigatorio"> *</span>}
      </label>
      {filho}
      {ajuda && <small className="ajuda">{ajuda}</small>}
    </div>
  );
}

/** Diálogo modal com foco gerenciado e fechamento por Esc. */
export function Modal({ titulo, aberto, aoFechar, children }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!aberto) return undefined;
    const anterior = document.activeElement;
    const el = ref.current;
    el?.querySelector('textarea, input, select, button')?.focus();
    const onKey = (e) => e.key === 'Escape' && aoFechar();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      anterior?.focus?.();
    };
  }, [aberto, aoFechar]);
  if (!aberto) return null;
  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-titulo" ref={ref}>
        <div className="modal-cabecalho">
          <h2 id="modal-titulo">{titulo}</h2>
          <button type="button" className="botao-icone" onClick={aoFechar} aria-label="Fechar">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Vazio({ children }) {
  return <p className="vazio">{children}</p>;
}
