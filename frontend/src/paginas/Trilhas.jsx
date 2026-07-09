import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, formatarData } from '../api';
import { useAuth } from '../AuthContext';
import { Capa, Modal, useToast } from '../componentes/Uteis';

/* ================= LISTA DE TRILHAS ================= */
export function Trilhas() {
  const { temPapel } = useAuth();
  const avisar = useToast();
  const [trilhas, setTrilhas] = useState(null);
  const [editando, setEditando] = useState(null); // null | {} (nova) | trilha

  const carregar = () =>
    api(`trilhas${temPapel('gerente') ? '?todas=1' : ''}`).then((r) => setTrilhas(r.trilhas)).catch(() => {});
  useEffect(() => { carregar(); }, []);

  if (!trilhas) return <div className="vazio"><span className="icone">🛤️</span>Carregando…</div>;

  return (
    <>
      <div className="pagina-cabecalho">
        <div>
          <h1>Trilhas de Leitura</h1>
          <p>Jornadas de discipulado guiadas por livros — conclua todas as leituras e ganhe conquistas.</p>
        </div>
        {temPapel('gerente') && (
          <button className="botao" onClick={() => setEditando({})}>+ Nova trilha</button>
        )}
      </div>

      {trilhas.length === 0 && (
        <div className="vazio"><span className="icone">🛤️</span>Nenhuma trilha publicada ainda.</div>
      )}

      <div className="grade-2">
        {trilhas.map((t) => {
          const progresso = t.total_livros > 0 ? Math.round((t.livros_lidos / t.total_livros) * 100) : 0;
          return (
            <div key={t.id} className="card" style={{ borderTop: `4px solid ${t.cor}`, opacity: t.ativa ? 1 : 0.6 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'start' }}>
                <span style={{ fontSize: '2rem' }}>{t.icone}</span>
                <div style={{ flex: 1 }}>
                  <h2 style={{ marginBottom: 2 }}>
                    <Link to={`/trilhas/${t.id}`}>{t.nome}</Link>
                    {!t.ativa && <span className="chip neutro" style={{ marginLeft: 8 }}>Inativa</span>}
                  </h2>
                  <p style={{ margin: '0 0 10px', color: 'var(--texto-2)', fontSize: '0.86rem' }}>{t.descricao}</p>
                  <div style={{ display: 'flex', gap: 12, fontSize: '0.76rem', color: 'var(--texto-3)', marginBottom: 8 }}>
                    <span>📚 {t.total_livros} livros</span>
                    <span>👥 {t.total_inscritos} inscritos</span>
                    <span>🏁 {t.total_concluintes} concluíram</span>
                  </div>
                  {t.minha_inscricao && (
                    <>
                      <div className="progresso"><div style={{ width: `${progresso}%` }} /></div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--texto-2)', marginTop: 4 }}>
                        {t.minha_inscricao.data_conclusao
                          ? `✅ Concluída em ${formatarData(t.minha_inscricao.data_conclusao)}`
                          : `${t.livros_lidos} de ${t.total_livros} livros lidos (${progresso}%)`}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <Link to={`/trilhas/${t.id}`} className="botao secundario pequeno">Ver jornada</Link>
                {temPapel('gerente') && (
                  <button className="botao fantasma pequeno" onClick={() => setEditando(t)}>Editar</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {editando !== null && (
        <FormTrilha
          trilha={editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => { setEditando(null); carregar(); avisar('Trilha salva!'); }}
        />
      )}
    </>
  );
}

/* ================= FORMULÁRIO (gerente+) ================= */
function FormTrilha({ trilha, aoFechar, aoSalvar }) {
  const avisar = useToast();
  const editando = !!trilha.id;
  const [form, setForm] = useState({
    nome: trilha.nome || '',
    descricao: trilha.descricao || '',
    icone: trilha.icone || '🛤️',
    cor: trilha.cor || '#1e3a5f',
    ativa: trilha.ativa !== 0,
  });
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState([]);
  const [livros, setLivros] = useState([]);

  useEffect(() => {
    if (editando) {
      api(`trilhas/${trilha.id}`).then((r) => setLivros(r.trilha.livros)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (busca.length < 2) return setResultados([]);
    const t = setTimeout(() => {
      api(`livros?busca=${encodeURIComponent(busca)}`)
        .then((r) => setResultados(r.livros.slice(0, 6)))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [busca]);

  const salvar = async (e) => {
    e.preventDefault();
    try {
      const body = { ...form, ativa: form.ativa ? 1 : 0, livros: livros.map((l) => l.id) };
      if (editando) await api(`trilhas/${trilha.id}`, { method: 'PUT', body });
      else await api('trilhas', { method: 'POST', body });
      aoSalvar();
    } catch (err) {
      avisar(err.message, 'erro');
    }
  };

  return (
    <Modal titulo={editando ? 'Editar trilha' : 'Nova Trilha de Leitura'} aoFechar={aoFechar}>
      <form onSubmit={salvar}>
        <div className="grade-form">
          <div className="campo" style={{ gridColumn: '1 / -1' }}>
            <label>Nome da trilha</label>
            <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required placeholder="Ex.: Fundamentos da Fé" />
          </div>
          <div className="campo">
            <label>Ícone (emoji)</label>
            <input value={form.icone} onChange={(e) => setForm({ ...form, icone: e.target.value })} maxLength={4} />
          </div>
          <div className="campo">
            <label>Cor</label>
            <input type="color" value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} style={{ height: 42 }} />
          </div>
        </div>
        <div className="campo">
          <label>Descrição</label>
          <textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Objetivo espiritual da jornada…" />
        </div>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 14, fontSize: '0.86rem', fontWeight: 600 }}>
          <input type="checkbox" checked={form.ativa} onChange={(e) => setForm({ ...form, ativa: e.target.checked })} />
          Trilha ativa (visível aos membros)
        </label>

        <div className="campo">
          <label>Adicionar livros do acervo</label>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Digite para buscar…" />
        </div>
        {resultados.length > 0 && (
          <div className="lista-simples" style={{ marginBottom: 12 }}>
            {resultados.map((l) => (
              <button
                key={l.id}
                type="button"
                className="item-linha"
                style={{ cursor: 'pointer', textAlign: 'left', font: 'inherit' }}
                onClick={() => {
                  if (!livros.find((x) => x.id === l.id)) setLivros([...livros, l]);
                  setBusca('');
                }}
              >
                <div className="principal"><div className="t">{l.titulo}</div><div className="s">{l.autor}</div></div>
                <span className="chip">+ adicionar</span>
              </button>
            ))}
          </div>
        )}
        {livros.length > 0 && (
          <ol style={{ paddingLeft: 20, marginBottom: 14 }}>
            {livros.map((l, i) => (
              <li key={l.id} style={{ marginBottom: 4, fontSize: '0.88rem' }}>
                {l.titulo}
                <button type="button" className="botao fantasma pequeno" onClick={() => setLivros(livros.filter((x) => x.id !== l.id))}>remover</button>
              </li>
            ))}
          </ol>
        )}
        <button className="botao" style={{ width: '100%' }}>Salvar trilha</button>
      </form>
    </Modal>
  );
}

/* ================= DETALHE DA TRILHA ================= */
export function TrilhaDetalhe() {
  const { id } = useParams();
  const avisar = useToast();
  const [trilha, setTrilha] = useState(null);

  const carregar = () => api(`trilhas/${id}`).then((r) => setTrilha(r.trilha)).catch(() => {});
  useEffect(() => { carregar(); }, [id]);

  if (!trilha) return <div className="vazio"><span className="icone">🛤️</span>Carregando…</div>;

  const lidos = trilha.livros.filter((l) => l.lido).length;
  const progresso = trilha.livros.length ? Math.round((lidos / trilha.livros.length) * 100) : 0;

  const inscrever = async () => {
    try {
      await api(`trilhas/${id}/inscrever`, { method: 'POST' });
      avisar('Jornada iniciada! Bons estudos.');
      carregar();
    } catch (e) {
      avisar(e.message, 'erro');
    }
  };

  return (
    <>
      <Link to="/trilhas" style={{ fontSize: '0.85rem' }}>← Todas as trilhas</Link>
      <div className="card" style={{ marginTop: 12, borderTop: `4px solid ${trilha.cor}` }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'start', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '2.6rem' }}>{trilha.icone}</span>
          <div style={{ flex: 1, minWidth: 220 }}>
            <h1>{trilha.nome}</h1>
            <p style={{ color: 'var(--texto-2)' }}>{trilha.descricao}</p>
            {trilha.minha_inscricao ? (
              <>
                <div className="progresso" style={{ maxWidth: 420 }}><div style={{ width: `${progresso}%` }} /></div>
                <p style={{ fontSize: '0.82rem', color: 'var(--texto-2)', marginTop: 6 }}>
                  {trilha.minha_inscricao.data_conclusao
                    ? `✅ Jornada concluída em ${formatarData(trilha.minha_inscricao.data_conclusao)} — glória a Deus!`
                    : `${lidos} de ${trilha.livros.length} livros lidos (${progresso}%). A leitura conta após a devolução do livro.`}
                </p>
              </>
            ) : (
              <button className="botao dourado" onClick={inscrever}>🛤️ Iniciar esta jornada</button>
            )}
          </div>
        </div>
      </div>

      <div className="lista-simples" style={{ marginTop: 18 }}>
        {trilha.livros.map((l, i) => (
          <div key={l.id} className="item-linha" style={{ opacity: l.lido ? 0.75 : 1 }}>
            <span style={{ fontWeight: 800, color: l.lido ? 'var(--ok)' : 'var(--texto-3)', width: 28, textAlign: 'center' }}>
              {l.lido ? '✓' : i + 1}
            </span>
            <Capa url={l.capa_url} titulo={l.titulo} />
            <div className="principal">
              <div className="t"><Link to={`/livro/${l.id}`}>{l.titulo}</Link></div>
              <div className="s">{l.autor}</div>
            </div>
            {l.lido
              ? <span className="chip ok">Lido</span>
              : Number(l.disponiveis) > 0
                ? <span className="chip ok">Disponível</span>
                : <span className="chip alerta">Fila</span>}
          </div>
        ))}
      </div>
    </>
  );
}
