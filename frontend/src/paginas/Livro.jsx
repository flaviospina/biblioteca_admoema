import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, formatarData } from '../api';
import { useAuth } from '../AuthContext';
import { Capa, Estrelas, SeloDisponibilidade, useToast } from '../componentes/Uteis';

export default function Livro() {
  const { id } = useParams();
  const { usuario, temPapel } = useAuth();
  const avisar = useToast();
  const [livro, setLivro] = useState(null);
  const [erro, setErro] = useState('');
  const [minhaNota, setMinhaNota] = useState(0);
  const [comentario, setComentario] = useState('');

  const carregar = () =>
    api(`livros/${id}`)
      .then(({ livro: l }) => {
        setLivro(l);
        const minha = l.avaliacoes.find((a) => a.usuario_id === usuario.id);
        if (minha) {
          setMinhaNota(minha.nota);
          setComentario(minha.comentario || '');
        }
      })
      .catch((e) => setErro(e.message));

  useEffect(() => { carregar(); }, [id]);

  if (erro) return <div className="aviso erro">{erro}</div>;
  if (!livro) return <div className="vazio"><span className="icone">🍞</span>Carregando…</div>;

  const disponiveis = livro.exemplares.filter((e) => e.status === 'disponivel').length;

  const reservar = async () => {
    try {
      const r = await api('reservas', { method: 'POST', body: { livro_id: livro.id } });
      avisar(r.mensagem || 'Reserva registrada!');
      carregar();
    } catch (e) {
      avisar(e.message, 'erro');
    }
  };

  const cancelarReserva = async () => {
    try {
      await api(`reservas/${livro.minha_reserva.id}`, { method: 'DELETE' });
      avisar('Reserva cancelada.');
      carregar();
    } catch (e) {
      avisar(e.message, 'erro');
    }
  };

  const avaliar = async (e) => {
    e.preventDefault();
    try {
      await api('avaliacoes', { method: 'POST', body: { livro_id: livro.id, nota: minhaNota, comentario } });
      avisar('Avaliação registrada. Obrigado!');
      carregar();
    } catch (err) {
      avisar(err.message, 'erro');
    }
  };

  const rotuloStatus = { disponivel: ['ok', 'Disponível'], emprestado: ['alerta', 'Emprestado'], reservado: ['alerta', 'Separado p/ reserva'], manutencao: ['neutro', 'Em manutenção'], perdido: ['erro', 'Perdido'] };

  return (
    <>
      <Link to="/" style={{ fontSize: '0.85rem' }}>← Voltar ao catálogo</Link>
      <div className="card" style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'minmax(140px, 200px) 1fr', gap: 24 }}>
        <div>
          <Capa url={livro.capa_url} titulo={livro.titulo} className="scanner-video" />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            {livro.categoria_nome && <span className="chip" style={{ background: `${livro.categoria_cor}22`, color: livro.categoria_cor }}>{livro.categoria_nome}</span>}
            <SeloDisponibilidade disponiveis={disponiveis} />
            {livro.fila_reservas > 0 && <span className="chip neutro">{livro.fila_reservas} na fila</span>}
          </div>
          <h1>{livro.titulo}</h1>
          {livro.subtitulo && <p style={{ color: 'var(--texto-2)', marginTop: -6 }}>{livro.subtitulo}</p>}
          <p style={{ fontWeight: 600 }}>{livro.autor}</p>
          <p style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Estrelas nota={livro.nota_media} />
            <span style={{ fontSize: '0.8rem', color: 'var(--texto-3)' }}>
              {livro.nota_media ? `${livro.nota_media} · ${livro.avaliacoes.length} avaliação(ões)` : 'Seja o primeiro a avaliar'}
            </span>
          </p>

          <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '6px 18px', fontSize: '0.84rem', margin: '14px 0' }}>
            {livro.editora && <div><dt style={{ color: 'var(--texto-3)' }}>Editora</dt><dd style={{ margin: 0, fontWeight: 600 }}>{livro.editora}</dd></div>}
            {livro.ano_publicacao && <div><dt style={{ color: 'var(--texto-3)' }}>Ano</dt><dd style={{ margin: 0, fontWeight: 600 }}>{livro.ano_publicacao}</dd></div>}
            {livro.paginas && <div><dt style={{ color: 'var(--texto-3)' }}>Páginas</dt><dd style={{ margin: 0, fontWeight: 600 }}>{livro.paginas}</dd></div>}
            {livro.isbn && <div><dt style={{ color: 'var(--texto-3)' }}>ISBN</dt><dd style={{ margin: 0, fontWeight: 600 }}>{livro.isbn}</dd></div>}
            {livro.localizacao && <div><dt style={{ color: 'var(--texto-3)' }}>Localização</dt><dd style={{ margin: 0, fontWeight: 600 }}>{livro.localizacao}</dd></div>}
          </dl>

          {livro.sinopse && <p style={{ color: 'var(--texto-2)' }}>{livro.sinopse}</p>}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
            {livro.minha_reserva ? (
              <button className="botao perigo" onClick={cancelarReserva}>Cancelar minha reserva</button>
            ) : (
              <button className="botao dourado" onClick={reservar}>
                {disponiveis > 0 ? 'Reservar para retirada' : 'Entrar na fila de espera'}
              </button>
            )}
            {temPapel('bibliotecario') && (
              <Link to={`/admin/livros/${livro.id}/editar`} className="botao secundario">✏️ Editar livro</Link>
            )}
          </div>
          <p style={{ fontSize: '0.76rem', color: 'var(--texto-3)', marginTop: 8 }}>
            A retirada e a devolução do livro físico acontecem na biblioteca da igreja.
          </p>
        </div>
      </div>

      {temPapel('bibliotecario') && (
        <div className="card" style={{ marginTop: 18 }}>
          <h2>Exemplares físicos</h2>
          <div className="tabela-wrap" style={{ boxShadow: 'none' }}>
            <table>
              <thead><tr><th>Tombo</th><th>Status</th><th>Conservação</th><th>Origem</th></tr></thead>
              <tbody>
                {livro.exemplares.map((e) => (
                  <tr key={e.id}>
                    <td style={{ fontFamily: 'monospace' }}>{e.codigo}</td>
                    <td><span className={`chip ${rotuloStatus[e.status]?.[0]}`}>{rotuloStatus[e.status]?.[1] || e.status}</span></td>
                    <td>{e.estado_conservacao}</td>
                    <td>{e.origem === 'doacao' ? `Doação${e.doador ? ` (${e.doador})` : ''}` : 'Compra'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 18 }}>
        <h2>Avaliações dos leitores</h2>
        <form onSubmit={avaliar} style={{ borderBottom: '1px solid var(--borda)', paddingBottom: 16, marginBottom: 16 }}>
          <Estrelas nota={minhaNota} aoMudar={setMinhaNota} />
          <div className="campo" style={{ marginTop: 8 }}>
            <textarea
              placeholder="O que este livro falou ao seu coração? (opcional)"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
            />
          </div>
          <button className="botao pequeno" disabled={!minhaNota}>Publicar avaliação</button>
        </form>

        {livro.avaliacoes.length === 0 && <p style={{ color: 'var(--texto-3)' }}>Ainda não há avaliações.</p>}
        <div className="lista-simples">
          {livro.avaliacoes.map((a) => (
            <div key={a.id} className="item-linha">
              <div className="principal">
                <div className="t">{a.usuario_nome} <Estrelas nota={a.nota} /></div>
                {a.comentario && <div>{a.comentario}</div>}
                <div className="s">{formatarData(a.criado_em)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
