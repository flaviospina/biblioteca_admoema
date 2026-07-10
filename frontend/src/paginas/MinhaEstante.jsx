import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatarData } from '../api';
import { Capa, Estrelas, confirmar, useToast } from '../componentes/Uteis';

export default function MinhaEstante() {
  const avisar = useToast();
  const [dados, setDados] = useState(null);

  const carregar = () => api('minha-estante').then(setDados).catch(() => {});
  useEffect(() => { carregar(); }, []);

  if (!dados) return <div className="vazio"><span className="icone">🍞</span>Carregando…</div>;

  const renovar = async (id) => {
    try {
      const r = await api(`emprestimos/${id}/renovar`, { method: 'POST' });
      avisar(`Renovado! Nova devolução: ${formatarData(r.nova_data_prevista)}`);
      carregar();
    } catch (e) {
      avisar(e.message, 'erro');
    }
  };

  const cancelarReserva = async (id) => {
    if (!(await confirmar('Cancelar esta reserva?', 'Você perderá sua posição na fila.', 'Sim, cancelar'))) return;
    try {
      await api(`reservas/${id}`, { method: 'DELETE' });
      avisar('Reserva cancelada.');
      carregar();
    } catch (e) {
      avisar(e.message, 'erro');
    }
  };

  return (
    <>
      <div className="pagina-cabecalho">
        <div>
          <h1>Minha Estante</h1>
          <p>{dados.estatisticas.livros_lidos} livro{dados.estatisticas.livros_lidos === 1 ? '' : 's'} lido{dados.estatisticas.livros_lidos === 1 ? '' : 's'} até hoje — a Palavra frutificando!</p>
        </div>
      </div>

      {dados.conquistas.length > 0 && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h2>🏅 Minhas conquistas</h2>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {dados.conquistas.map((c, i) => (
              <span key={i} className="chip" title={c.descricao} style={{ fontSize: '0.82rem', padding: '7px 14px' }}>
                {c.icone} {c.nome}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grade-2">
        <div className="card">
          <h2>📖 Comigo agora</h2>
          {dados.emprestimos_ativos.length === 0 && (
            <div className="vazio" style={{ padding: 20 }}>
              Nenhum livro emprestado. <Link to="/">Explore o catálogo!</Link>
            </div>
          )}
          <div className="lista-simples">
            {dados.emprestimos_ativos.map((e) => (
              <div key={e.id} className="item-linha">
                <Capa url={e.capa_url} titulo={e.titulo} />
                <div className="principal">
                  <div className="t"><Link to={`/livro/${e.livro_id}`}>{e.titulo}</Link></div>
                  <div className="s">
                    Devolver até {formatarData(e.data_prevista)}
                    {e.status === 'atrasado'
                      ? <span className="chip erro" style={{ marginLeft: 6 }}>Atrasado</span>
                      : e.dias_restantes <= 3 && <span className="chip alerta" style={{ marginLeft: 6 }}>{e.dias_restantes} dia(s)</span>}
                  </div>
                </div>
                {e.status === 'ativo' && (
                  <button className="botao secundario pequeno" onClick={() => renovar(e.id)}>Renovar</button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>🔖 Minhas reservas</h2>
          {dados.reservas.length === 0 && <div className="vazio" style={{ padding: 20 }}>Nenhuma reserva ativa.</div>}
          <div className="lista-simples">
            {dados.reservas.map((r) => (
              <div key={r.id} className="item-linha">
                <Capa url={r.capa_url} titulo={r.titulo} />
                <div className="principal">
                  <div className="t">{r.titulo}</div>
                  <div className="s">
                    {r.status === 'disponivel'
                      ? <span className="chip ok">Disponível! Retire até {formatarData(r.data_expiracao)}</span>
                      : <>Posição na fila: <strong>{r.posicao_fila}º</strong> · desde {formatarData(r.data_reserva)}</>}
                  </div>
                </div>
                <button className="botao fantasma pequeno" onClick={() => cancelarReserva(r.id)}>Cancelar</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {dados.trilhas.length > 0 && (
        <div className="card" style={{ marginTop: 18 }}>
          <h2>🛤️ Minhas trilhas</h2>
          <div className="lista-simples">
            {dados.trilhas.map((t) => (
              <div key={t.id} className="item-linha">
                <span style={{ fontSize: '1.6rem' }}>{t.icone}</span>
                <div className="principal">
                  <div className="t"><Link to={`/trilhas/${t.id}`}>{t.nome}</Link></div>
                  <div className="s">
                    {t.data_conclusao
                      ? <span className="chip ok">Concluída em {formatarData(t.data_conclusao)}</span>
                      : `Iniciada em ${formatarData(t.data_inscricao)} · ${t.total_livros} livros`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 18 }}>
        <h2>🕰️ Histórico de leitura</h2>
        {dados.historico.length === 0 && <div className="vazio" style={{ padding: 20 }}>Seu histórico aparecerá aqui após a primeira devolução.</div>}
        {dados.historico.length > 0 && (
          <div className="tabela-wrap" style={{ boxShadow: 'none' }}>
            <table>
              <thead>
                <tr><th>Livro</th><th>Retirado</th><th>Devolvido</th><th>Minha nota</th></tr>
              </thead>
              <tbody>
                {dados.historico.map((h) => (
                  <tr key={h.id}>
                    <td>
                      <Link to={`/livro/${h.livro_id}`} style={{ fontWeight: 600 }}>{h.titulo}</Link>
                      <div style={{ fontSize: '0.76rem', color: 'var(--texto-3)' }}>{h.autor}</div>
                    </td>
                    <td>{formatarData(h.data_emprestimo)}</td>
                    <td>{formatarData(h.data_devolucao)}</td>
                    <td>
                      {h.minha_nota
                        ? <Estrelas nota={h.minha_nota} />
                        : <Link to={`/livro/${h.livro_id}`} style={{ fontSize: '0.8rem' }}>Avaliar</Link>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
