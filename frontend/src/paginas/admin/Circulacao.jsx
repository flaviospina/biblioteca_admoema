import { useEffect, useState } from 'react';
import { api, formatarData } from '../../api';
import { Modal, useToast } from '../../componentes/Uteis';

/* ---------------- Novo empréstimo (balcão) ---------------- */
function NovoEmprestimo({ aoFechar, aoCriar }) {
  const avisar = useToast();
  const [buscaLeitor, setBuscaLeitor] = useState('');
  const [leitores, setLeitores] = useState([]);
  const [leitor, setLeitor] = useState(null);
  const [buscaLivro, setBuscaLivro] = useState('');
  const [livros, setLivros] = useState([]);
  const [exemplar, setExemplar] = useState(null);
  const [codigoTombo, setCodigoTombo] = useState('');

  useEffect(() => {
    if (buscaLeitor.length < 2) return setLeitores([]);
    const t = setTimeout(() => {
      api(`usuarios?busca=${encodeURIComponent(buscaLeitor)}`)
        .then((r) => setLeitores(r.usuarios.slice(0, 6)))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [buscaLeitor]);

  useEffect(() => {
    if (buscaLivro.length < 2) return setLivros([]);
    const t = setTimeout(() => {
      api(`livros?busca=${encodeURIComponent(buscaLivro)}`)
        .then((r) => setLivros(r.livros.slice(0, 6)))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [buscaLivro]);

  const escolherLivro = async (l) => {
    setBuscaLivro('');
    setLivros([]);
    try {
      const { livro } = await api(`livros/${l.id}`);
      const livre = livro.exemplares.find((e) => e.status === 'disponivel') || livro.exemplares.find((e) => e.status === 'reservado');
      if (!livre) return avisar('Nenhum exemplar deste livro está disponível.', 'erro');
      setExemplar({ ...livre, titulo: livro.titulo });
    } catch (e) {
      avisar(e.message, 'erro');
    }
  };

  const emprestar = async () => {
    try {
      const body = { usuario_id: leitor.id };
      if (codigoTombo) body.exemplar_codigo = codigoTombo.trim();
      else body.exemplar_id = exemplar.id;
      const r = await api('emprestimos', { method: 'POST', body });
      avisar(`Empréstimo registrado! Devolução até ${formatarData(r.data_prevista)}.`);
      aoCriar();
    } catch (e) {
      avisar(e.message, 'erro');
    }
  };

  return (
    <Modal titulo="Novo empréstimo" aoFechar={aoFechar}>
      <div className="campo">
        <label>1. Leitor</label>
        {leitor ? (
          <div className="item-linha">
            <div className="principal">
              <div className="t">{leitor.nome}</div>
              <div className="s">{leitor.email} · {leitor.emprestimos_ativos} empréstimo(s) ativo(s)</div>
            </div>
            <button className="botao fantasma pequeno" onClick={() => setLeitor(null)}>trocar</button>
          </div>
        ) : (
          <input placeholder="Buscar leitor por nome ou e-mail…" value={buscaLeitor} onChange={(e) => setBuscaLeitor(e.target.value)} autoFocus />
        )}
      </div>
      {!leitor && leitores.length > 0 && (
        <div className="lista-simples" style={{ marginBottom: 14 }}>
          {leitores.map((u) => (
            <button key={u.id} type="button" className="item-linha" style={{ cursor: 'pointer', textAlign: 'left', font: 'inherit' }} onClick={() => { setLeitor(u); setBuscaLeitor(''); }}>
              <div className="principal">
                <div className="t">{u.nome}</div>
                <div className="s">{u.email}{Number(u.atrasos) > 0 && <span className="chip erro" style={{ marginLeft: 6 }}>com atraso</span>}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="campo">
        <label>2. Livro — pelo código de tombo da etiqueta…</label>
        <input placeholder="Ex.: MN-00012-01" value={codigoTombo} onChange={(e) => { setCodigoTombo(e.target.value); setExemplar(null); }} />
      </div>
      <div className="campo">
        <label>…ou buscando pelo título</label>
        {exemplar ? (
          <div className="item-linha">
            <div className="principal">
              <div className="t">{exemplar.titulo}</div>
              <div className="s">Tombo {exemplar.codigo}</div>
            </div>
            <button className="botao fantasma pequeno" onClick={() => setExemplar(null)}>trocar</button>
          </div>
        ) : (
          <input placeholder="Buscar por título ou autor…" value={buscaLivro} onChange={(e) => setBuscaLivro(e.target.value)} disabled={!!codigoTombo} />
        )}
      </div>
      {!exemplar && livros.length > 0 && (
        <div className="lista-simples" style={{ marginBottom: 14 }}>
          {livros.map((l) => (
            <button key={l.id} type="button" className="item-linha" style={{ cursor: 'pointer', textAlign: 'left', font: 'inherit' }} onClick={() => escolherLivro(l)}>
              <div className="principal">
                <div className="t">{l.titulo}</div>
                <div className="s">{l.autor} · {l.disponiveis} disponível(is)</div>
              </div>
            </button>
          ))}
        </div>
      )}

      <button className="botao" style={{ width: '100%' }} disabled={!leitor || (!exemplar && !codigoTombo)} onClick={emprestar}>
        📖 Registrar empréstimo
      </button>
    </Modal>
  );
}

/* ---------------- Página ---------------- */
export default function Circulacao() {
  const avisar = useToast();
  const [aba, setAba] = useState('emprestimos');
  const [emprestimos, setEmprestimos] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [busca, setBusca] = useState('');
  const [novo, setNovo] = useState(false);

  const carregar = () => {
    const q = new URLSearchParams();
    if (filtro) q.set('status', filtro);
    if (busca) q.set('busca', busca);
    api(`emprestimos?${q}`).then((r) => setEmprestimos(r.emprestimos)).catch(() => {});
    api('reservas').then((r) => setReservas(r.reservas)).catch(() => {});
  };
  useEffect(() => { carregar(); }, [filtro]);

  const devolver = async (e) => {
    try {
      const r = await api(`emprestimos/${e.id}/devolver`, { method: 'POST' });
      avisar(
        r.proxima_reserva
          ? 'Devolvido! ⚠️ Há reserva na fila: o exemplar ficou SEPARADO para o próximo leitor (ele foi notificado).'
          : 'Devolução registrada. Exemplar disponível novamente.'
      );
      carregar();
    } catch (err) {
      avisar(err.message, 'erro');
    }
  };

  const renovar = async (e) => {
    try {
      const r = await api(`emprestimos/${e.id}/renovar`, { method: 'POST' });
      avisar(`Renovado até ${formatarData(r.nova_data_prevista)}.`);
      carregar();
    } catch (err) {
      avisar(err.message, 'erro');
    }
  };

  const cancelarReserva = async (r) => {
    if (!window.confirm(`Cancelar a reserva de "${r.titulo}" de ${r.usuario_nome}?`)) return;
    try {
      await api(`reservas/${r.id}`, { method: 'DELETE' });
      avisar('Reserva cancelada.');
      carregar();
    } catch (err) {
      avisar(err.message, 'erro');
    }
  };

  const chipStatus = { ativo: ['chip', 'Ativo'], atrasado: ['chip erro', 'Atrasado'], devolvido: ['chip ok', 'Devolvido'] };
  const chipReserva = { ativa: ['chip', 'Na fila'], disponivel: ['chip ok', 'Aguardando retirada'], atendida: ['chip ok', 'Atendida'], cancelada: ['chip neutro', 'Cancelada'], expirada: ['chip alerta', 'Expirada'] };

  return (
    <>
      <div className="pagina-cabecalho">
        <div>
          <h1>Circulação</h1>
          <p>Empréstimos, devoluções, renovações e fila de reservas.</p>
        </div>
        <button className="botao" onClick={() => setNovo(true)}>+ Novo empréstimo</button>
      </div>

      <div className="abas" style={{ maxWidth: 420 }}>
        <button className={aba === 'emprestimos' ? 'ativa' : ''} onClick={() => setAba('emprestimos')}>📖 Empréstimos</button>
        <button className={aba === 'reservas' ? 'ativa' : ''} onClick={() => setAba('reservas')}>🔖 Reservas</button>
      </div>

      {aba === 'emprestimos' && (
        <>
          <div className="card" style={{ marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <form style={{ flex: '1 1 240px', display: 'flex', gap: 8 }} onSubmit={(e) => { e.preventDefault(); carregar(); }}>
              <input
                style={{ flex: 1, padding: '9px 13px', border: '1.5px solid var(--borda)', borderRadius: 10, font: 'inherit' }}
                placeholder="Buscar por livro, leitor ou tombo…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
              <button className="botao secundario">Buscar</button>
            </form>
            <select value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ padding: '9px 13px', border: '1.5px solid var(--borda)', borderRadius: 10, font: 'inherit' }}>
              <option value="">Todos os status</option>
              <option value="ativo">Ativos</option>
              <option value="atrasado">Atrasados</option>
              <option value="devolvido">Devolvidos</option>
            </select>
          </div>

          <div className="tabela-wrap">
            <table>
              <thead>
                <tr><th>Livro / Tombo</th><th>Leitor</th><th>Retirada</th><th>Devolução prevista</th><th>Status</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {emprestimos.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--texto-3)' }}>Nenhum empréstimo encontrado.</td></tr>}
                {emprestimos.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <strong>{e.titulo}</strong>
                      <div style={{ fontSize: '0.74rem', color: 'var(--texto-3)', fontFamily: 'monospace' }}>{e.exemplar_codigo}</div>
                    </td>
                    <td>{e.usuario_nome}</td>
                    <td>{formatarData(e.data_emprestimo)}</td>
                    <td>
                      {formatarData(e.data_prevista)}
                      {e.status === 'atrasado' && <div style={{ fontSize: '0.72rem', color: 'var(--erro)', fontWeight: 700 }}>{e.dias_atraso} dia(s) de atraso</div>}
                      {Number(e.renovacoes) > 0 && <div style={{ fontSize: '0.72rem', color: 'var(--texto-3)' }}>{e.renovacoes} renovação(ões)</div>}
                    </td>
                    <td><span className={chipStatus[e.status][0]}>{chipStatus[e.status][1]}</span></td>
                    <td>
                      {e.status !== 'devolvido' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="botao pequeno" onClick={() => devolver(e)}>Devolver</button>
                          {e.status === 'ativo' && <button className="botao secundario pequeno" onClick={() => renovar(e)}>Renovar</button>}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {aba === 'reservas' && (
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr><th>Livro</th><th>Leitor</th><th>Reservado em</th><th>Posição / Situação</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {reservas.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--texto-3)' }}>Nenhuma reserva.</td></tr>}
              {reservas.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.titulo}</strong><div style={{ fontSize: '0.74rem', color: 'var(--texto-3)' }}>{r.autor}</div></td>
                  <td>{r.usuario_nome}</td>
                  <td>{formatarData(r.data_reserva)}</td>
                  <td>
                    <span className={chipReserva[r.status][0]}>{chipReserva[r.status][1]}</span>
                    {r.status === 'ativa' && <span style={{ marginLeft: 6, fontSize: '0.76rem', color: 'var(--texto-3)' }}>{r.posicao_fila}º da fila</span>}
                    {r.status === 'disponivel' && r.data_expiracao && <div style={{ fontSize: '0.72rem', color: 'var(--alerta)' }}>Retirar até {formatarData(r.data_expiracao)}</div>}
                  </td>
                  <td>
                    {['ativa', 'disponivel'].includes(r.status) && (
                      <button className="botao fantasma pequeno" onClick={() => cancelarReserva(r)}>Cancelar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {novo && <NovoEmprestimo aoFechar={() => setNovo(false)} aoCriar={() => { setNovo(false); carregar(); }} />}
    </>
  );
}
