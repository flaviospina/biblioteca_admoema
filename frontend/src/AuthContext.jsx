import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setSessao, limparSessao } from './api';

const AuthContext = createContext(null);

export const NIVEIS = { usuario: 1, bibliotecario: 2, gerente: 3, admin: 4 };
export const NOMES_PAPEIS = {
  usuario: 'Leitor',
  bibliotecario: 'Bibliotecário',
  gerente: 'Gerente',
  admin: 'Administrador',
};

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('mana_usuario') || 'null');
    } catch {
      return null;
    }
  });
  const [carregando, setCarregando] = useState(!!getToken());

  useEffect(() => {
    if (!getToken()) return;
    api('auth/me')
      .then(({ usuario: u }) => setUsuario(u))
      .catch(() => setUsuario(null))
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    const sair = () => setUsuario(null);
    window.addEventListener('mana:sessao-expirada', sair);
    return () => window.removeEventListener('mana:sessao-expirada', sair);
  }, []);

  const entrar = (token, u) => {
    setSessao(token, u);
    setUsuario(u);
  };

  const sair = () => {
    limparSessao();
    setUsuario(null);
  };

  const atualizarUsuario = (parcial) => {
    setUsuario((u) => {
      const novo = { ...u, ...parcial };
      localStorage.setItem('mana_usuario', JSON.stringify(novo));
      return novo;
    });
  };

  const temPapel = (minimo) => usuario && NIVEIS[usuario.papel] >= NIVEIS[minimo];

  return (
    <AuthContext.Provider value={{ usuario, carregando, entrar, sair, temPapel, atualizarUsuario }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
