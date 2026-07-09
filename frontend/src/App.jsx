import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { ToastProvider } from './componentes/Uteis';
import Layout from './componentes/Layout';
import Login from './paginas/Login';
import Catalogo from './paginas/Catalogo';
import Livro from './paginas/Livro';
import MinhaEstante from './paginas/MinhaEstante';
import { Trilhas, TrilhaDetalhe } from './paginas/Trilhas';
import Sugestoes from './paginas/Sugestoes';
import Dashboard from './paginas/admin/Dashboard';
import Acervo from './paginas/admin/Acervo';
// Carregada sob demanda: inclui a biblioteca de leitura de código de barras
const LivroForm = lazy(() => import('./paginas/admin/LivroForm'));
import Circulacao from './paginas/admin/Circulacao';
import Usuarios from './paginas/admin/Usuarios';
import Sistema from './paginas/admin/Sistema';

function RotaProtegida({ papel, children }) {
  const { usuario, carregando, temPapel } = useAuth();
  if (carregando) return <div className="vazio"><span className="icone">🍞</span>Carregando…</div>;
  if (!usuario) return <Navigate to="/entrar" replace />;
  if (papel && !temPapel(papel)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { usuario } = useAuth();
  return (
    <ToastProvider>
      <Suspense fallback={<div className="vazio"><span className="icone">🍞</span>Carregando…</div>}>
      <Routes>
        <Route path="/entrar" element={usuario ? <Navigate to="/" replace /> : <Login />} />
        <Route element={<RotaProtegida><Layout /></RotaProtegida>}>
          <Route path="/" element={<Catalogo />} />
          <Route path="/livro/:id" element={<Livro />} />
          <Route path="/minha-estante" element={<MinhaEstante />} />
          <Route path="/trilhas" element={<Trilhas />} />
          <Route path="/trilhas/:id" element={<TrilhaDetalhe />} />
          <Route path="/sugestoes" element={<Sugestoes />} />
          <Route path="/admin/dashboard" element={<RotaProtegida papel="bibliotecario"><Dashboard /></RotaProtegida>} />
          <Route path="/admin/livros" element={<RotaProtegida papel="bibliotecario"><Acervo /></RotaProtegida>} />
          <Route path="/admin/livros/novo" element={<RotaProtegida papel="bibliotecario"><LivroForm /></RotaProtegida>} />
          <Route path="/admin/livros/:id/editar" element={<RotaProtegida papel="bibliotecario"><LivroForm /></RotaProtegida>} />
          <Route path="/admin/circulacao" element={<RotaProtegida papel="bibliotecario"><Circulacao /></RotaProtegida>} />
          <Route path="/admin/usuarios" element={<RotaProtegida papel="bibliotecario"><Usuarios /></RotaProtegida>} />
          <Route path="/admin/sistema" element={<RotaProtegida papel="gerente"><Sistema /></RotaProtegida>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </ToastProvider>
  );
}
