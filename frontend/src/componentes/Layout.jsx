import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth, NOMES_PAPEIS } from '../AuthContext';
import { api, LOGO_URL, formatarData } from '../api';
import { Avatar, avisar, redimensionarFoto } from './Uteis';

/** Foto do próprio usuário na barra superior — clique para enviar/trocar. */
function MinhaFoto() {
  const { usuario, atualizarUsuario } = useAuth();
  const inputRef = useRef(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    setEnviando(true);
    try {
      const imagem = await redimensionarFoto(arquivo);
      const r = await api('auth/foto', { method: 'POST', body: { imagem } });
      atualizarUsuario({ foto_url: `${r.foto_url}?${Date.now()}` });
      avisar('Foto de perfil atualizada!');
    } catch (err) {
      avisar(err.message, 'erro');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        title="Clique para enviar/trocar sua foto"
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', opacity: enviando ? 0.5 : 1 }}
      >
        <Avatar url={usuario?.foto_url} nome={usuario?.nome} tamanho={40} />
      </button>
      <input ref={inputRef} type="file" accept="image/*" capture="user" hidden onChange={enviar} />
    </>
  );
}

function Sino() {
  const [aberto, setAberto] = useState(false);
  const [dados, setDados] = useState({ notificacoes: [], nao_lidas: 0 });
  const ref = useRef(null);

  const carregar = () => api('notificacoes').then(setDados).catch(() => {});

  useEffect(() => {
    carregar();
    const intervalo = setInterval(carregar, 90_000);
    return () => clearInterval(intervalo);
  }, []);

  useEffect(() => {
    const fora = (e) => ref.current && !ref.current.contains(e.target) && setAberto(false);
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, []);

  const abrir = async () => {
    setAberto(!aberto);
    if (!aberto && dados.nao_lidas > 0) {
      await api('notificacoes/ler', { method: 'POST' }).catch(() => {});
      setDados((d) => ({ ...d, nao_lidas: 0 }));
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="sino" onClick={abrir} aria-label="Notificações">
        🔔
        {dados.nao_lidas > 0 && <span className="bolha">{dados.nao_lidas}</span>}
      </button>
      {aberto && (
        <div className="painel-notificacoes">
          {dados.notificacoes.length === 0 && <div className="vazio" style={{ padding: 24 }}>Sem notificações.</div>}
          {dados.notificacoes.map((n) => (
            <div key={n.id} className={`notificacao-item ${n.lida ? '' : 'nao-lida'}`}>
              <strong>{n.titulo}</strong>
              {n.mensagem && <div>{n.mensagem}</div>}
              <div className="quando">{formatarData(n.criado_em)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { usuario, sair, temPapel } = useAuth();
  const [menuAberto, setMenuAberto] = useState(false);
  const local = useLocation();

  useEffect(() => setMenuAberto(false), [local.pathname]);

  const Item = ({ para, icone, children }) => (
    <NavLink to={para} end className={({ isActive }) => `nav-item ${isActive ? 'ativo' : ''}`}>
      <span className="icone">{icone}</span> {children}
    </NavLink>
  );

  return (
    <div className="app">
      {menuAberto && <div className="fundo-menu" onClick={() => setMenuAberto(false)} />}
      <aside className={`sidebar ${menuAberto ? 'aberta' : ''}`}>
        <div className="sidebar-marca">
          <img src={LOGO_URL} alt="Logo AD Belém Moema" onError={(e) => { e.target.style.display = 'none'; }} />
          <div>
            <div className="nome">MANÁ</div>
            <div className="sub">Biblioteca Digital</div>
          </div>
        </div>
        <nav>
          <Item para="/" icone="📚">Catálogo</Item>
          <Item para="/minha-estante" icone="🎒">Minha Estante</Item>
          <Item para="/trilhas" icone="🛤️">Trilhas de Leitura</Item>
          <Item para="/sugestoes" icone="💡">Sugestões</Item>

          {temPapel('bibliotecario') && (
            <>
              <div className="secao">Administração</div>
              <Item para="/admin/dashboard" icone="📊">Dashboard</Item>
              <Item para="/admin/circulacao" icone="🔄">Circulação</Item>
              <Item para="/admin/livros" icone="📖">Acervo</Item>
              <Item para="/admin/livros/novo" icone="📷">Cadastrar Livro</Item>
              <Item para="/admin/usuarios" icone="👥">Usuários</Item>
            </>
          )}
          {temPapel('gerente') && <Item para="/admin/sistema" icone="⚙️">Sistema</Item>}
        </nav>
        <div className="sidebar-rodape">
          AD Ministério Belém<br />Setor 124 — Moema
        </div>
      </aside>

      <div className="conteudo">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="botao secundario pequeno botao-menu" onClick={() => setMenuAberto(true)} aria-label="Abrir menu">☰</button>
            <MinhaFoto />
            <div className="saudacao">
              A paz do Senhor, {usuario?.nome?.split(' ')[0]}!
              <small>{NOMES_PAPEIS[usuario?.papel]} · {usuario?.congregacao}</small>
            </div>
          </div>
          <div className="topbar-acoes">
            <Sino />
            <button className="botao secundario pequeno" onClick={sair}>Sair</button>
          </div>
        </header>
        <main className="pagina">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
