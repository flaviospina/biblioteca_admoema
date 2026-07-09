import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatarData } from '../../api';
import { Capa } from '../../componentes/Uteis';

const AZUL = '#2563eb';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const rotuloMes = (aaaa_mm) => {
  const [a, m] = aaaa_mm.split('-');
  return `${MESES[parseInt(m, 10) - 1]}/${a.slice(2)}`;
};

/* Barras verticais — empréstimos por mês (série única: cor da marca) */
function GraficoMensal({ dados }) {
  const [ativo, setAtivo] = useState(null);

  // Completa os 12 meses, inclusive os sem registros
  const meses = [];
  const agora = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    meses.push({ mes: chave, total: Number(dados.find((x) => x.mes === chave)?.total || 0) });
  }

  const L = 640, A = 220, mEsq = 30, mBaixo = 26, mTopo = 14;
  const max = Math.max(4, ...meses.map((m) => m.total));
  const larguraBarra = (L - mEsq) / meses.length - 6;

  return (
    <svg className="grafico" viewBox={`0 0 ${L} ${A}`} role="img" aria-label="Empréstimos por mês nos últimos 12 meses" style={{ width: '100%' }}>
      {[0, 0.5, 1].map((f) => {
        const y = mTopo + (1 - f) * (A - mBaixo - mTopo);
        return (
          <g key={f}>
            <line className="grade-linha" x1={mEsq} x2={L} y1={y} y2={y} />
            <text className="eixo" x={mEsq - 6} y={y + 3} textAnchor="end">{Math.round(f * max)}</text>
          </g>
        );
      })}
      {meses.map((m, i) => {
        const x = mEsq + i * ((L - mEsq) / meses.length) + 3;
        const h = Math.max(m.total > 0 ? 3 : 0, (m.total / max) * (A - mBaixo - mTopo));
        const y = A - mBaixo - h;
        return (
          <g key={m.mes} onMouseEnter={() => setAtivo(i)} onMouseLeave={() => setAtivo(null)}>
            {/* alvo de interação maior que a marca */}
            <rect x={x - 3} y={mTopo} width={larguraBarra + 6} height={A - mBaixo - mTopo} fill="transparent" />
            <rect x={x} y={y} width={larguraBarra} height={h} rx="4" fill={AZUL} opacity={ativo === null || ativo === i ? 1 : 0.45} />
            {/* fecha o raio inferior na linha de base */}
            {h > 4 && <rect x={x} y={A - mBaixo - 4} width={larguraBarra} height={4} fill={AZUL} opacity={ativo === null || ativo === i ? 1 : 0.45} />}
            <text className="eixo" x={x + larguraBarra / 2} y={A - 8} textAnchor="middle">{rotuloMes(m.mes)}</text>
            {ativo === i && (
              <text className="valor-direto" x={x + larguraBarra / 2} y={y - 5} textAnchor="middle">{m.total}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* Barras horizontais — empréstimos por categoria (identidade nos rótulos) */
function GraficoCategorias({ dados }) {
  const [ativo, setAtivo] = useState(null);
  if (!dados.length) return <p style={{ color: 'var(--texto-3)' }}>Sem empréstimos registrados ainda.</p>;
  const max = Math.max(...dados.map((d) => Number(d.total)));
  return (
    <div role="img" aria-label="Empréstimos por categoria">
      {dados.map((d, i) => (
        <div
          key={d.categoria}
          onMouseEnter={() => setAtivo(i)}
          onMouseLeave={() => setAtivo(null)}
          style={{ display: 'grid', gridTemplateColumns: '150px 1fr 34px', gap: 8, alignItems: 'center', marginBottom: 7, fontSize: '0.8rem' }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--texto-2)', fontWeight: 600 }} title={d.categoria}>
            {d.categoria}
          </span>
          <div style={{ background: '#eef1f6', borderRadius: 4, height: 14 }}>
            <div
              style={{
                width: `${(Number(d.total) / max) * 100}%`,
                height: '100%',
                borderRadius: 4,
                background: AZUL,
                opacity: ativo === null || ativo === i ? 1 : 0.45,
                transition: 'opacity 0.1s',
              }}
            />
          </div>
          <strong style={{ color: 'var(--texto-2)' }}>{d.total}</strong>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api('dashboard').then(setD).catch((e) => setErro(e.message));
  }, []);

  if (erro) return <div className="aviso erro">{erro}</div>;
  if (!d) return <div className="vazio"><span className="icone">📊</span>Calculando indicadores…</div>;

  const t = d.totais;

  const linkWhats = (whatsapp, titulo, atraso) => {
    if (!whatsapp) return null;
    const numero = whatsapp.replace(/\D/g, '');
    const msg = encodeURIComponent(
      `A paz do Senhor! Aqui é da Biblioteca MANÁ (AD Belém - Moema). ` +
      (atraso
        ? `O livro "${titulo}" está com a devolução em atraso. Pode trazê-lo no próximo culto? Deus abençoe! 🙏`
        : `Lembrete: a devolução do livro "${titulo}" está próxima. Deus abençoe! 🙏`)
    );
    return `https://wa.me/55${numero}?text=${msg}`;
  };

  return (
    <>
      <div className="pagina-cabecalho">
        <div>
          <h1>Dashboard</h1>
          <p>Visão geral da biblioteca — atualizada agora.</p>
        </div>
        <Link to="/admin/circulacao" className="botao">🔄 Ir para a circulação</Link>
      </div>

      <div className="grade-indicadores">
        <div className="indicador"><div className="rotulo">Títulos no acervo</div><div className="valor">{t.livros}</div><div className="contexto">{t.exemplares} exemplares físicos</div></div>
        <div className="indicador"><div className="rotulo">Disponíveis agora</div><div className="valor">{t.exemplares_disponiveis}</div><div className="contexto">prontos para empréstimo</div></div>
        <div className="indicador"><div className="rotulo">Empréstimos ativos</div><div className="valor">{t.emprestimos_ativos}</div><div className="contexto">{t.emprestimos_mes} novos neste mês</div></div>
        <div className={`indicador ${t.emprestimos_atrasados > 0 ? 'atencao' : ''}`}><div className="rotulo">Em atraso</div><div className="valor">{t.emprestimos_atrasados}</div><div className="contexto">precisam de contato</div></div>
        <div className="indicador"><div className="rotulo">Reservas na fila</div><div className="valor">{t.reservas_ativas}</div><div className="contexto">aguardando retirada</div></div>
        <div className="indicador destaque"><div className="rotulo">Leitores ativos</div><div className="valor">{t.usuarios_ativos}</div><div className="contexto">{t.sugestoes_pendentes} sugestões pendentes</div></div>
      </div>

      <div className="grade-2">
        <div className="card">
          <h2>Empréstimos por mês</h2>
          <GraficoMensal dados={d.emprestimos_por_mes} />
        </div>
        <div className="card">
          <h2>Empréstimos por categoria</h2>
          <GraficoCategorias dados={d.por_categoria} />
        </div>
      </div>

      <div className="grade-2" style={{ marginTop: 18 }}>
        <div className="card">
          <h2>⚠️ Devoluções em atraso</h2>
          {d.atrasados.length === 0 && <p style={{ color: 'var(--ok)', fontWeight: 600 }}>✓ Nenhum atraso. Aleluia!</p>}
          <div className="lista-simples">
            {d.atrasados.map((a) => (
              <div key={a.id} className="item-linha">
                <div className="principal">
                  <div className="t">{a.titulo}</div>
                  <div className="s">{a.usuario_nome} · {a.dias_atraso} dia(s) de atraso</div>
                </div>
                {linkWhats(a.whatsapp, a.titulo, true) && (
                  <a className="botao secundario pequeno" href={linkWhats(a.whatsapp, a.titulo, true)} target="_blank" rel="noreferrer">
                    Cobrar via WhatsApp
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>📅 Devoluções nos próximos 7 dias</h2>
          {d.devolucoes_proximas.length === 0 && <p style={{ color: 'var(--texto-3)' }}>Nada previsto para a semana.</p>}
          <div className="lista-simples">
            {d.devolucoes_proximas.map((a) => (
              <div key={a.id} className="item-linha">
                <div className="principal">
                  <div className="t">{a.titulo}</div>
                  <div className="s">{a.usuario_nome} · até {formatarData(a.data_prevista)}</div>
                </div>
                {linkWhats(a.whatsapp, a.titulo, false) && (
                  <a className="botao fantasma pequeno" href={linkWhats(a.whatsapp, a.titulo, false)} target="_blank" rel="noreferrer">
                    Lembrar
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grade-2" style={{ marginTop: 18 }}>
        <div className="card">
          <h2>🔥 Livros mais emprestados</h2>
          <div className="lista-simples">
            {d.top_livros.map((l, i) => (
              <div key={l.id} className="item-linha">
                <strong style={{ width: 22, textAlign: 'center', color: i < 3 ? 'var(--dourado-600)' : 'var(--texto-3)' }}>{i + 1}º</strong>
                <Capa url={l.capa_url} titulo={l.titulo} />
                <div className="principal">
                  <div className="t"><Link to={`/livro/${l.id}`}>{l.titulo}</Link></div>
                  <div className="s">{l.autor}</div>
                </div>
                <span className="chip">{l.total}×</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>🏆 Leitores mais assíduos</h2>
          <div className="lista-simples">
            {d.top_leitores.map((l, i) => (
              <div key={l.id} className="item-linha">
                <strong style={{ width: 22, textAlign: 'center', color: i < 3 ? 'var(--dourado-600)' : 'var(--texto-3)' }}>{i + 1}º</strong>
                <div className="principal">
                  <div className="t">{l.nome}</div>
                  <div className="s">{l.total} livros lidos · {l.conquistas} conquista(s)</div>
                </div>
              </div>
            ))}
          </div>

          <h2 style={{ marginTop: 22 }}>🕐 Atividade recente</h2>
          <div style={{ fontSize: '0.8rem', color: 'var(--texto-2)' }}>
            {d.atividade_recente.map((a, i) => (
              <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--borda)' }}>
                <strong>{a.usuario_nome || 'Sistema'}</strong> — {a.acao.replaceAll('_', ' ')}
                {a.detalhes && <span style={{ color: 'var(--texto-3)' }}> · {a.detalhes}</span>}
                <div style={{ fontSize: '0.7rem', color: 'var(--texto-3)' }}>{formatarData(a.criado_em)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
