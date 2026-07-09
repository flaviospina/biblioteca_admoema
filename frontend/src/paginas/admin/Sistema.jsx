import { useEffect, useState } from 'react';
import { api, formatarData } from '../../api';
import { useAuth } from '../../AuthContext';
import { useToast } from '../../componentes/Uteis';

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

      <div className="abas" style={{ maxWidth: 420 }}>
        <button className={aba === 'config' ? 'ativa' : ''} onClick={() => setAba('config')}>⚙️ Configurações</button>
        <button className={aba === 'auditoria' ? 'ativa' : ''} onClick={() => setAba('auditoria')}>🧾 Auditoria</button>
      </div>

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
