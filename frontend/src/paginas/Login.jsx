import { useState } from 'react';
import { api, LOGO_URL } from '../api';
import { useAuth } from '../AuthContext';
import { CampoTelefone } from '../componentes/Uteis';

export default function Login() {
  const { entrar } = useAuth();
  const [aba, setAba] = useState('entrar');
  const [form, setForm] = useState({ nome: '', email: '', senha: '', telefone: '' });
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const mudar = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const enviar = async (e) => {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      const rota = aba === 'entrar' ? 'auth/login' : 'auth/registro';
      const { token, usuario } = await api(rota, { method: 'POST', body: form });
      entrar(token, usuario);
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="tela-login">
      <div className="login-lado">
        <img className="logo" src={LOGO_URL} alt="Logo AD Ministério Belém - Setor 124 Moema" onError={(e) => { e.target.style.display = 'none'; }} />
        <div>
          <h1>MANÁ</h1>
          <div style={{ color: '#f0c987', fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', fontSize: '0.8rem' }}>
            Biblioteca Digital
          </div>
        </div>
        <p className="versiculo">
          "Eu sou o pão vivo que desceu do céu; se alguém comer deste pão, viverá para sempre." — João 6:51
        </p>
        <p style={{ color: '#c8d6ea', maxWidth: 460 }}>
          Belém significa <strong>"Casa do Pão"</strong>. O MANÁ é a estante da nossa casa:
          empréstimos, reservas, trilhas de leitura e muito alimento para a alma.
        </p>
        <div className="igreja">Assembleia de Deus · Ministério Belém · Setor 124 Moema</div>
      </div>

      <div className="login-form">
        <form className="card" onSubmit={enviar}>
          <div className="abas">
            <button type="button" className={aba === 'entrar' ? 'ativa' : ''} onClick={() => setAba('entrar')}>Entrar</button>
            <button type="button" className={aba === 'registrar' ? 'ativa' : ''} onClick={() => setAba('registrar')}>Criar conta</button>
          </div>

          {erro && <div className="aviso erro">{erro}</div>}

          {aba === 'registrar' && (
            <>
              <div className="campo">
                <label htmlFor="nome">Nome completo</label>
                <input id="nome" name="nome" value={form.nome} onChange={mudar} required autoComplete="name" />
              </div>
              <div className="campo">
                <label htmlFor="telefone">Telefone / WhatsApp (opcional)</label>
                <CampoTelefone
                  id="telefone"
                  value={form.telefone}
                  onChange={(v) => setForm((f) => ({ ...f, telefone: v, whatsapp: v }))}
                />
              </div>
            </>
          )}

          <div className="campo">
            <label htmlFor="email">E-mail</label>
            <input id="email" type="email" name="email" value={form.email} onChange={mudar} required autoComplete="email" />
          </div>
          <div className="campo">
            <label htmlFor="senha">Senha</label>
            <input id="senha" type="password" name="senha" value={form.senha} onChange={mudar} required minLength={6} autoComplete={aba === 'entrar' ? 'current-password' : 'new-password'} />
          </div>

          <button className="botao" style={{ width: '100%' }} disabled={enviando}>
            {enviando ? 'Aguarde…' : aba === 'entrar' ? 'Entrar na biblioteca' : 'Criar minha conta'}
          </button>

          <p style={{ fontSize: '0.78rem', color: 'var(--texto-3)', textAlign: 'center', marginTop: 14 }}>
            Dúvidas? Procure a equipe da biblioteca após os cultos.
          </p>
        </form>
      </div>
    </div>
  );
}
