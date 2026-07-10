import { useState } from 'react';
import Swal from 'sweetalert2';

// ------------------------------------------------------- SweetAlert (janelas modais)
const swal = Swal.mixin({
  confirmButtonColor: '#2563eb',
  cancelButtonColor: '#8b95ab',
  confirmButtonText: 'OK',
});

/** Modal de resultado de operação: sucesso fecha sozinho, erro pede OK. */
export function avisar(mensagem, tipo = 'ok') {
  if (tipo === 'erro') {
    return swal.fire({ icon: 'error', title: 'Ops!', text: mensagem });
  }
  return swal.fire({
    icon: 'success',
    title: mensagem,
    timer: 2100,
    timerProgressBar: true,
    showConfirmButton: false,
  });
}

/** Modal de confirmação — retorna true se o usuário confirmar. */
export async function confirmar(titulo, texto = '', textoBotao = 'Sim, confirmar') {
  const r = await swal.fire({
    icon: 'question',
    title: titulo,
    text: texto,
    showCancelButton: true,
    confirmButtonText: textoBotao,
    cancelButtonText: 'Voltar',
  });
  return r.isConfirmed;
}

/** Modal de carregamento (para operações demoradas, ex.: leitura da foto). */
export function carregando(titulo, texto = '') {
  swal.fire({
    title: titulo,
    text: texto,
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => Swal.showLoading(),
  });
  return { fechar: () => Swal.close(), atualizar: (t) => Swal.update({ text: t }) };
}

// Compatibilidade com o restante do app: useToast() devolve a função avisar
export function ToastProvider({ children }) {
  return children;
}
export const useToast = () => avisar;

// ------------------------------------------------------- Modal próprio (formulários)
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

// ------------------------------------------------------- Avatar do membro
export function Avatar({ url, nome, tamanho = 36 }) {
  const [falhou, setFalhou] = useState(false);
  const src = url && !url.startsWith('http') && !url.startsWith('data:')
    ? `${import.meta.env.BASE_URL}${url}`
    : url;
  const iniciais = (nome || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
  const estilo = {
    width: tamanho, height: tamanho, borderRadius: '50%', objectFit: 'cover', flexShrink: 0,
    background: 'var(--azul-100)', color: 'var(--azul-700)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: tamanho * 0.38, border: '2px solid var(--borda)',
  };
  if (!src || falhou) {
    return <span style={estilo} aria-label={nome}>{iniciais}</span>;
  }
  return <img src={src} alt={`Foto de ${nome}`} style={estilo} onError={() => setFalhou(true)} />;
}

/** Redimensiona uma foto no navegador antes do envio (máx. 480px, JPEG). */
export function redimensionarFoto(arquivo, max = 480) {
  return new Promise((resolver, rejeitar) => {
    const img = new Image();
    const url = URL.createObjectURL(arquivo);
    img.onload = () => {
      const escala = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolver(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rejeitar(new Error('Arquivo de imagem inválido.')); };
    img.src = url;
  });
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
