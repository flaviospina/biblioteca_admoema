import { useEffect, useState } from 'react';
import { api, formatarData } from '../api';
import { useAuth } from '../AuthContext';
import { useToast } from '../componentes/Uteis';

const STATUS = {
  pendente:  ['neutro', '⏳ Em análise'],
  aprovada:  ['ok', '✅ Aprovada'],
  adquirida: ['ok', '📚 No acervo'],
  recusada:  ['erro', 'Recusada'],
};

export default function Sugestoes() {
  const { temPapel } = useAuth();
  const avisar = useToast();
  const [sugestoes, setSugestoes] = useState(null);
  const [form, setForm] = useState({ titulo: '', autor: '', motivo: '' });

  const carregar = () => api('sugestoes').then((r) => setSugestoes(r.sugestoes)).catch(() => {});
  useEffect(() => { carregar(); }, []);

  const enviar = async (e) => {
    e.preventDefault();
    try {
      await api('sugestoes', { method: 'POST', body: form });
      avisar('Sugestão enviada! A equipe irá analisá-la.');
      setForm({ titulo: '', autor: '', motivo: '' });
      carregar();
    } catch (err) {
      avisar(err.message, 'erro');
    }
  };

  const mudarStatus = async (id, status) => {
    try {
      await api(`sugestoes/${id}`, { method: 'PUT', body: { status } });
      carregar();
    } catch (err) {
      avisar(err.message, 'erro');
    }
  };

  return (
    <>
      <div className="pagina-cabecalho">
        <div>
          <h1>Sugestões de Aquisição</h1>
          <p>Sentiu falta de um livro? Indique para o acervo da biblioteca.</p>
        </div>
      </div>

      <div className="grade-2">
        <form className="card" onSubmit={enviar}>
          <h2>💡 Nova sugestão</h2>
          <div className="campo">
            <label>Título do livro</label>
            <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required />
          </div>
          <div className="campo">
            <label>Autor (se souber)</label>
            <input value={form.autor} onChange={(e) => setForm({ ...form, autor: e.target.value })} />
          </div>
          <div className="campo">
            <label>Por que este livro edificaria a igreja?</label>
            <textarea value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} />
          </div>
          <button className="botao">Enviar sugestão</button>
        </form>

        <div className="card">
          <h2>{temPapel('bibliotecario') ? 'Todas as sugestões' : 'Minhas sugestões'}</h2>
          {!sugestoes && <div className="vazio">Carregando…</div>}
          {sugestoes?.length === 0 && <div className="vazio" style={{ padding: 20 }}>Nenhuma sugestão ainda.</div>}
          <div className="lista-simples">
            {sugestoes?.map((s) => (
              <div key={s.id} className="item-linha">
                <div className="principal">
                  <div className="t">{s.titulo}</div>
                  <div className="s">
                    {s.autor && <>{s.autor} · </>}
                    {temPapel('bibliotecario') && <>por {s.usuario_nome} · </>}
                    {formatarData(s.criado_em)}
                  </div>
                  {s.motivo && <div style={{ fontSize: '0.82rem', color: 'var(--texto-2)' }}>{s.motivo}</div>}
                </div>
                {temPapel('gerente') && s.status === 'pendente' ? (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="botao pequeno" onClick={() => mudarStatus(s.id, 'aprovada')}>Aprovar</button>
                    <button className="botao fantasma pequeno" onClick={() => mudarStatus(s.id, 'recusada')}>Recusar</button>
                  </div>
                ) : temPapel('gerente') && s.status === 'aprovada' ? (
                  <button className="botao dourado pequeno" onClick={() => mudarStatus(s.id, 'adquirida')}>Marcar adquirida</button>
                ) : (
                  <span className={`chip ${STATUS[s.status][0]}`}>{STATUS[s.status][1]}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
