import { useEffect, useState } from 'react';
import { api, formatarData } from '../../api';
import { useAuth } from '../../AuthContext';
import { useToast } from '../../componentes/Uteis';

/** Testa as fontes de consulta bibliográfica direto do servidor da hospedagem. */
function DiagnosticoFontes() {
  const [resultado, setResultado] = useState(null);
  const [rodando, setRodando] = useState(false);

  const rodar = async () => {
    setRodando(true);
    setResultado(null);
    try {
      setResultado(await api('isbn/diagnostico'));
    } catch (e) {
      setResultado({ diagnostico: [], dica: e.message });
    } finally {
      setRodando(false);
    }
  };

  const chip = (s) => (s === 'ok'
    ? <span className="chip ok">✓ Funcionando</span>
    : s === 'sem_resultados'
      ? <span className="chip alerta">Respondeu vazio (possível bloqueio/cota)</span>
      : <span className="chip erro">Erro</span>);

  return (
    <div className="card" style={{ maxWidth: 720 }}>
      <p style={{ color: 'var(--texto-2)', marginTop: 0 }}>
        Testa cada catálogo usado no cadastro de livros <strong>a partir do servidor</strong> —
        útil para descobrir se a hospedagem está bloqueando alguma fonte ou se a
        cota do Google Books esgotou.
      </p>
      <button className="botao" onClick={rodar} disabled={rodando}>
        {rodando ? 'Testando as fontes…' : '🩺 Testar fontes agora'}
      </button>
      {resultado && (
        <>
          <div className="lista-simples" style={{ marginTop: 16 }}>
            {resultado.diagnostico.map((f) => (
              <div key={f.fonte} className="item-linha">
                <div className="principal">
                  <div className="t">{f.fonte}</div>
                  <div className="s">
                    {f.resultados != null && `${f.resultados} resultado(s)`}
                    {f.tempo_ms != null && ` · ${f.tempo_ms} ms`}
                    {f.detalhe && ` · ${f.detalhe}`}
                  </div>
                </div>
                {chip(f.status)}
              </div>
            ))}
          </div>
          {resultado.dica && <div className="aviso info" style={{ marginTop: 14 }}>{resultado.dica}</div>}
        </>
      )}
    </div>
  );
}

export default function Sistema() {
  const { temPapel } = useAuth();
  const avisar = useToast();
  const [aba, setAba] = useState('config');
  const [config, setConfig] = useState([]);
  const [auditoria, setAuditoria] = useState([]);
  const [buscaAud, setBuscaAud] = useState('');

  useEffect(() => {
    api('configuracoes').then((r) => setConfig(r.configuracoes)).catch(() => {});
    carregarAuditoria();
  }, []);

  const carregarAuditoria = () => {
    const q = buscaAud ? `?busca=${encodeURIComponent(buscaAud)}` : '';
    api(`auditoria${q}`).then((r) => setAuditoria(r.auditoria)).catch(() => {});
  };

  const salvarConfig = async (e) => {
    e.preventDefault();
    try {
      await api('configuracoes', {
        method: 'PUT',
        body: Object.fromEntries(config.map((c) => [c.chave, c.valor])),
      });
      avisar('Configurações salvas!');
    } catch (err) {
      avisar(err.message, 'erro');
    }
  };

  return (
    <>
      <div className="pagina-cabecalho">
        <div>
          <h1>Sistema</h1>
          <p>Parâmetros de circulação e trilha de auditoria.</p>
        </div>
      </div>

      <div className="abas" style={{ maxWidth: 560 }}>
        <button className={aba === 'config' ? 'ativa' : ''} onClick={() => setAba('config')}>⚙️ Configurações</button>
        <button className={aba === 'auditoria' ? 'ativa' : ''} onClick={() => setAba('auditoria')}>🧾 Auditoria</button>
        <button className={aba === 'diagnostico' ? 'ativa' : ''} onClick={() => setAba('diagnostico')}>🩺 Fontes de consulta</button>
      </div>

      {aba === 'diagnostico' && <DiagnosticoFontes />}

      {aba === 'config' && (
        <form className="card" onSubmit={salvarConfig} style={{ maxWidth: 640 }}>
          {!temPapel('admin') && (
            <div className="aviso info">Somente o administrador pode alterar estes valores — exibição apenas para consulta.</div>
          )}
          {config.map((c, i) => (
            <div className="campo" key={c.chave}>
              <label>{c.descricao || c.chave}</label>
              <input
                value={c.valor}
                disabled={!temPapel('admin')}
                onChange={(e) => {
                  const novo = [...config];
                  novo[i] = { ...c, valor: e.target.value };
                  setConfig(novo);
                }}
              />
            </div>
          ))}
          {temPapel('admin') && <button className="botao">Salvar configurações</button>}
        </form>
      )}

      {aba === 'auditoria' && (
        <>
          <form className="card" style={{ marginBottom: 14, display: 'flex', gap: 8 }} onSubmit={(e) => { e.preventDefault(); carregarAuditoria(); }}>
            <input
              style={{ flex: 1, padding: '9px 13px', border: '1.5px solid var(--borda)', borderRadius: 10, font: 'inherit' }}
              placeholder="Filtrar por usuário, ação ou detalhe…"
              value={buscaAud}
              onChange={(e) => setBuscaAud(e.target.value)}
            />
            <button className="botao secundario">Filtrar</button>
          </form>
          <div className="tabela-wrap">
            <table>
              <thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Entidade</th><th>Detalhes</th></tr></thead>
              <tbody>
                {auditoria.map((a) => (
                  <tr key={a.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatarData(a.criado_em)}</td>
                    <td>{a.usuario_nome || 'Sistema'}</td>
                    <td><span className="chip neutro">{a.acao.replaceAll('_', ' ')}</span></td>
                    <td>{a.entidade}{a.entidade_id ? ` #${a.entidade_id}` : ''}</td>
                    <td style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.detalhes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
