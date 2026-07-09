import { createContext, useCallback, useContext, useState } from 'react';

// ------------------------------------------------------- Toast global
const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const avisar = useCallback((mensagem, tipo = 'ok') => {
    setToast({ mensagem, tipo });
    setTimeout(() => setToast(null), 3800);
  }, []);
  return (
    <ToastContext.Provider value={avisar}>
      {children}
      {toast && <div className={`toast ${toast.tipo === 'erro' ? 'erro' : ''}`}>{toast.mensagem}</div>}
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);

// ------------------------------------------------------- Modal
export function Modal({ titulo, aoFechar, children }) {
  return (
    <div className="modal-fundo" onClick={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <h2>{titulo}</h2>
          <button className="botao fantasma pequeno" onClick={aoFechar} aria-label="Fechar">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ------------------------------------------------------- Capa de livro
export function Capa({ url, titulo, className = 'mini-capa' }) {
  const [falhou, setFalhou] = useState(false);
  if (!url || falhou) {
    return (
      <div className={className} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }} aria-hidden>
        📖
      </div>
    );
  }
  return <img className={className} src={url} alt={`Capa de ${titulo || 'livro'}`} onError={() => setFalhou(true)} loading="lazy" />;
}

// ------------------------------------------------------- Estrelas
export function Estrelas({ nota, aoMudar }) {
  if (aoMudar) {
    return (
      <div className="estrelas interativa" role="radiogroup" aria-label="Nota">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" className={n <= nota ? 'cheia' : ''} onClick={() => aoMudar(n)} aria-label={`${n} estrelas`}>
            ★
          </button>
        ))}
      </div>
    );
  }
  const cheia = Math.round(Number(nota) || 0);
  return (
    <span className="estrelas" title={nota ? `Nota ${nota}` : 'Sem avaliações'}>
      {'★'.repeat(cheia)}
      <span style={{ color: '#cbd5e1' }}>{'★'.repeat(5 - cheia)}</span>
    </span>
  );
}

// ------------------------------------------------------- Selo de disponibilidade
export function SeloDisponibilidade({ disponiveis }) {
  const n = Number(disponiveis) || 0;
  return n > 0
    ? <span className="chip ok">✓ {n} disponíve{n > 1 ? 'is' : 'l'}</span>
    : <span className="chip alerta">Fila de espera</span>;
}
