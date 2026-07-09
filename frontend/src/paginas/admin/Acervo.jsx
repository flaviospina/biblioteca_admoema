import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../AuthContext';
import { Capa, useToast } from '../../componentes/Uteis';

export default function Acervo() {
  const { temPapel } = useAuth();
  const avisar = useToast();
  const [dados, setDados] = useState({ livros: [], total: 0, pagina: 1, paginas: 1 });
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);

  const carregar = () => {
    const q = new URLSearchParams({ pagina: String(pagina) });
    if (busca) q.set('busca', busca);
    api(`livros?${q}`).then(setDados).catch(() => {});
  };
  useEffect(() => { carregar(); }, [pagina]);

  const excluir = async (l) => {
    if (!window.confirm(`Excluir "${l.titulo}" e todos os seus exemplares? Esta ação não pode ser desfeita.`)) return;
    try {
      await api(`livros/${l.id}`, { method: 'DELETE' });
      avisar('Livro excluído.');
      carregar();
    } catch (e) {
      avisar(e.message, 'erro');
    }
  };

  return (
    <>
      <div className="pagina-cabecalho">
        <div>
          <h1>Gestão do Acervo</h1>
          <p>{dados.total} títulos cadastrados</p>
        </div>
        <Link to="/admin/livros/novo" className="botao">📷 Cadastrar livro</Link>
      </div>

      <form
        className="card"
        style={{ marginBottom: 16, display: 'flex', gap: 8 }}
        onSubmit={(e) => { e.preventDefault(); setPagina(1); carregar(); }}
      >
        <input
          style={{ flex: 1, padding: '10px 13px', border: '1.5px solid var(--borda)', borderRadius: 10, font: 'inherit' }}
          placeholder="Buscar por título, autor ou ISBN…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <button className="botao">Buscar</button>
      </form>

      <div className="tabela-wrap">
        <table>
          <thead>
            <tr><th>Livro</th><th>Categoria</th><th>Exemplares</th><th>Disponíveis</th><th>Nota</th><th>Ações</th></tr>
          </thead>
          <tbody>
            {dados.livros.map((l) => (
              <tr key={l.id}>
                <td>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <Capa url={l.capa_url} titulo={l.titulo} />
                    <div>
                      <Link to={`/livro/${l.id}`} style={{ fontWeight: 600 }}>{l.titulo}</Link>
                      <div style={{ fontSize: '0.76rem', color: 'var(--texto-3)' }}>{l.autor}{l.isbn ? ` · ${l.isbn}` : ''}</div>
                    </div>
                  </div>
                </td>
                <td>{l.categoria_nome || '—'}</td>
                <td>{l.total_exemplares}</td>
                <td>
                  {Number(l.disponiveis) > 0
                    ? <span className="chip ok">{l.disponiveis}</span>
                    : <span className="chip alerta">0</span>}
                </td>
                <td>{l.nota_media ?? '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Link className="botao secundario pequeno" to={`/admin/livros/${l.id}/editar`}>Editar</Link>
                    {temPapel('gerente') && (
                      <button className="botao fantasma pequeno" onClick={() => excluir(l)}>Excluir</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dados.paginas > 1 && (
        <div className="paginacao">
          {Array.from({ length: dados.paginas }, (_, i) => i + 1).map((p) => (
            <button key={p} className={`botao pequeno ${p === dados.pagina ? '' : 'secundario'}`} onClick={() => setPagina(p)}>{p}</button>
          ))}
        </div>
      )}
    </>
  );
}
