import { useEffect, useRef, useState } from 'react';
import { api, formatarData } from '../../api';
import { useAuth, NOMES_PAPEIS } from '../../AuthContext';
import { Avatar, Modal, redimensionarFoto, useToast } from '../../componentes/Uteis';

function FormUsuario({ usuario, aoFechar, aoSalvar }) {
  const { usuario: eu } = useAuth();
  const avisar = useToast();
  const editando = !!usuario?.id;
  const [form, setForm] = useState({
    nome: usuario?.nome || '',
    email: usuario?.email || '',
    telefone: usuario?.telefone || '',
    whatsapp: usuario?.whatsapp || '',
    papel: usuario?.papel || 'usuario',
    congregacao: usuario?.congregacao || 'Setor 124 - Moema',
    status: usuario?.status || 'ativo',
    senha: '',
    nova_senha: '',
    foto: '', // data-URL da nova foto de rosto (opcional)
  });
  const fotoRef = useRef(null);

  const mudar = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const escolherFoto = async (e) => {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    try {
      const foto = await redimensionarFoto(arquivo);
      setForm((f) => ({ ...f, foto }));
    } catch (err) {
      avisar(err.message, 'erro');
    }
  };

  const papeisPermitidos = eu.papel === 'admin'
    ? ['usuario', 'bibliotecario', 'gerente', 'admin']
    : ['usuario', 'bibliotecario'];

  const salvar = async (e) => {
    e.preventDefault();
    try {
      if (editando) {
        await api(`usuarios/${usuario.id}`, { method: 'PUT', body: form });
      } else {
        await api('usuarios', { method: 'POST', body: form });
      }
      aoSalvar();
    } catch (err) {
      avisar(err.message, 'erro');
    }
  };

  return (
    <Modal titulo={editando ? `Editar ${usuario.nome}` : 'Novo usuário'} aoFechar={aoFechar}>
      <form onSubmit={salvar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          {form.foto
            ? <img src={form.foto} alt="Nova foto" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--borda)' }} />
            : <Avatar url={usuario?.foto_url} nome={form.nome || usuario?.nome} tamanho={64} />}
          <div>
            <button type="button" className="botao secundario pequeno" onClick={() => fotoRef.current?.click()}>
              📸 {form.foto || usuario?.foto_url ? 'Trocar foto de rosto' : 'Adicionar foto de rosto'}
            </button>
            <input ref={fotoRef} type="file" accept="image/*" capture="user" hidden onChange={escolherFoto} />
            <div style={{ fontSize: '0.72rem', color: 'var(--texto-3)', marginTop: 4 }}>
              Pode tirar na hora com a câmera ou escolher da galeria.
            </div>
          </div>
        </div>
        <div className="grade-form">
          <div className="campo" style={{ gridColumn: '1 / -1' }}>
            <label>Nome completo</label>
            <input name="nome" value={form.nome} onChange={mudar} required />
          </div>
          <div className="campo">
            <label>E-mail</label>
            <input name="email" type="email" value={form.email} onChange={mudar} required />
          </div>
          <div className="campo">
            <label>WhatsApp</label>
            <input name="whatsapp" value={form.whatsapp} onChange={mudar} placeholder="(11) 9…" />
          </div>
          <div className="campo">
            <label>Nível de acesso</label>
            <select name="papel" value={form.papel} onChange={mudar}>
              {papeisPermitidos.map((p) => <option key={p} value={p}>{NOMES_PAPEIS[p]}</option>)}
            </select>
          </div>
          <div className="campo">
            <label>Congregação</label>
            <input name="congregacao" value={form.congregacao} onChange={mudar} />
          </div>
          {editando ? (
            <>
              <div className="campo">
                <label>Status</label>
                <select name="status" value={form.status} onChange={mudar}>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                  <option value="bloqueado">Bloqueado</option>
                </select>
              </div>
              <div className="campo">
                <label>Nova senha (deixe em branco p/ manter)</label>
                <input name="nova_senha" type="password" value={form.nova_senha} onChange={mudar} minLength={6} autoComplete="new-password" />
              </div>
            </>
          ) : (
            <div className="campo">
              <label>Senha inicial</label>
              <input name="senha" type="password" value={form.senha} onChange={mudar} required minLength={6} autoComplete="new-password" />
            </div>
          )}
        </div>
        <button className="botao" style={{ width: '100%' }}>Salvar</button>
      </form>
    </Modal>
  );
}

export default function Usuarios() {
  const { temPapel } = useAuth();
  const avisar = useToast();
  const [usuarios, setUsuarios] = useState([]);
  const [busca, setBusca] = useState('');
  const [papel, setPapel] = useState('');
  const [editando, setEditando] = useState(null); // null | {} | usuario

  const carregar = () => {
    const q = new URLSearchParams();
    if (busca) q.set('busca', busca);
    if (papel) q.set('papel', papel);
    api(`usuarios?${q}`).then((r) => setUsuarios(r.usuarios)).catch(() => {});
  };
  useEffect(() => { carregar(); }, [papel]);

  const chipPapel = { admin: 'chip erro', gerente: 'chip alerta', bibliotecario: 'chip', usuario: 'chip neutro' };

  return (
    <>
      <div className="pagina-cabecalho">
        <div>
          <h1>Usuários</h1>
          <p>Leitores e equipe da biblioteca — {usuarios.length} encontrado(s).</p>
        </div>
        {temPapel('gerente') && <button className="botao" onClick={() => setEditando({})}>+ Novo usuário</button>}
      </div>

      <div className="card" style={{ marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <form style={{ flex: '1 1 240px', display: 'flex', gap: 8 }} onSubmit={(e) => { e.preventDefault(); carregar(); }}>
          <input
            style={{ flex: 1, padding: '9px 13px', border: '1.5px solid var(--borda)', borderRadius: 10, font: 'inherit' }}
            placeholder="Buscar por nome ou e-mail…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <button className="botao secundario">Buscar</button>
        </form>
        <select value={papel} onChange={(e) => setPapel(e.target.value)} style={{ padding: '9px 13px', border: '1.5px solid var(--borda)', borderRadius: 10, font: 'inherit' }}>
          <option value="">Todos os níveis</option>
          {Object.entries(NOMES_PAPEIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="tabela-wrap">
        <table>
          <thead>
            <tr><th>Nome</th><th>Contato</th><th>Nível</th><th>Status</th><th>Empréstimos</th><th>Último acesso</th><th>Ações</th></tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar url={u.foto_url} nome={u.nome} />
                    <div>
                      <strong>{u.nome}</strong>
                      <div style={{ fontSize: '0.74rem', color: 'var(--texto-3)' }}>{u.congregacao}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div style={{ fontSize: '0.8rem' }}>{u.email}</div>
                  {u.whatsapp && <div style={{ fontSize: '0.74rem', color: 'var(--texto-3)' }}>📱 {u.whatsapp}</div>}
                </td>
                <td><span className={chipPapel[u.papel]}>{NOMES_PAPEIS[u.papel]}</span></td>
                <td>{u.status === 'ativo' ? <span className="chip ok">Ativo</span> : <span className="chip neutro">{u.status}</span>}</td>
                <td>
                  {u.emprestimos_ativos} ativo(s)
                  {Number(u.atrasos) > 0 && <span className="chip erro" style={{ marginLeft: 6 }}>{u.atrasos} atraso(s)</span>}
                </td>
                <td>{formatarData(u.ultimo_acesso)}</td>
                <td>
                  {temPapel('gerente') && (
                    <button className="botao secundario pequeno" onClick={() => setEditando(u)}>Editar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editando !== null && (
        <FormUsuario
          usuario={editando.id ? editando : null}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => { setEditando(null); carregar(); avisar('Usuário salvo!'); }}
        />
      )}
    </>
  );
}
