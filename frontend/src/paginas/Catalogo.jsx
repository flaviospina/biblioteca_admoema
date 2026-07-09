import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { Capa, Estrelas, SeloDisponibilidade } from '../componentes/Uteis';

export default function Catalogo() {
  const [parametros, setParametros] = useSearchParams();
  const [dados, setDados] = useState({ livros: [], total: 0, pagina: 1, paginas: 1 });
  const [categorias, setCategorias] = useState([]);
  const [busca, setBusca] = useState(parametros.get('busca') || '');
  const [carregando, setCarregando] = useState(true);

  const categoria = parametros.get('categoria') || '';
  const pagina = parametros.get('pagina') || '1';
  const soDisponiveis = parametros.get('disponiveis') === '1';

  useEffect(() => {
    api('categorias').then((r) => setCategorias(r.categorias)).catch(() => {});
  }, []);

  useEffect(() => {
    setCarregando(true);
    const q = new URLSearchParams();
    if (parametros.get('busca')) q.set('busca', parametros.get('busca'));
    if (categoria) q.set('categoria', categoria);
    if (soDisponiveis) q.set('disponiveis', '1');
    q.set('pagina', pagina);
    api(`livros?${q}`)
      .then(setDados)
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, [parametros]);

  const atualizarFiltro = (mudancas) => {
    const novo = new URLSearchParams(parametros);
    Object.entries(mudancas).forEach(([k, v]) => (v ? novo.set(k, v) : novo.delete(k)));
    if (!('pagina' in mudancas)) novo.delete('pagina');
    setParametros(novo);
  };

  return (
    <>
      <div className="pagina-cabecalho">
        <div>
          <h1>Catálogo do Acervo</h1>
          <p>{dados.total} título{dados.total === 1 ? '' : 's'} na Casa do Pão</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <form
          style={{ flex: '1 1 260px', display: 'flex', gap: 8 }}
          onSubmit={(e) => { e.preventDefault(); atualizarFiltro({ busca }); }}
        >
          <input
            style={{ flex: 1, padding: '10px 13px', border: '1.5px solid var(--borda)', borderRadius: 10, font: 'inherit' }}
            placeholder="Buscar por título, autor, ISBN ou tema…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar no acervo"
          />
          <button className="botao">Buscar</button>
        </form>
        <select
          value={categoria}
          onChange={(e) => atualizarFiltro({ categoria: e.target.value })}
          style={{ padding: '10px 13px', border: '1.5px solid var(--borda)', borderRadius: 10, font: 'inherit' }}
          aria-label="Filtrar por categoria"
        >
          <option value="">Todas as categorias</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>{c.nome} ({c.total_livros})</option>
          ))}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', fontWeight: 600, color: 'var(--texto-2)' }}>
          <input
            type="checkbox"
            checked={soDisponiveis}
            onChange={(e) => atualizarFiltro({ disponiveis: e.target.checked ? '1' : '' })}
          />
          Só disponíveis
        </label>
      </div>

      {carregando ? (
        <div className="vazio"><span className="icone">🍞</span>Buscando no acervo…</div>
      ) : dados.livros.length === 0 ? (
        <div className="vazio">
          <span className="icone">🔎</span>
          Nenhum livro encontrado.
          <div style={{ marginTop: 10 }}>
            <Link to="/sugestoes" className="botao secundario pequeno">Sugerir este título para o acervo</Link>
          </div>
        </div>
      ) : (
        <div className="grade-livros">
          {dados.livros.map((l) => (
            <Link key={l.id} to={`/livro/${l.id}`} className="card-livro">
              <div className="capa">
                {l.capa_url
                  ? <Capa url={l.capa_url} titulo={l.titulo} className="" />
                  : <span className="sem-capa">📖</span>}
                <span className="selo-disponibilidade">
                  <SeloDisponibilidade disponiveis={l.disponiveis} />
                </span>
              </div>
              <div className="info">
                <div className="titulo">{l.titulo}</div>
                <div className="autor">{l.autor}</div>
                <div className="rodape">
                  <Estrelas nota={l.nota_media} />
                  {l.categoria_nome && <span className="chip neutro">{l.categoria_nome}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {dados.paginas > 1 && (
        <div className="paginacao">
          {Array.from({ length: dados.paginas }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              className={`botao pequeno ${p === dados.pagina ? '' : 'secundario'}`}
              onClick={() => atualizarFiltro({ pagina: String(p) })}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
