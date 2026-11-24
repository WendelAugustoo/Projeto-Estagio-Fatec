import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './services/auth';
import Layout from './components/Layout';
import { Carregando } from './components/ui';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Solicitacoes from './pages/Solicitacoes';
import SolicitacaoForm from './pages/SolicitacaoForm';
import SolicitacaoDetalhe from './pages/SolicitacaoDetalhe';
import Cadastros from './pages/Cadastros';
import Auditoria from './pages/Auditoria';

function Restrito({ perfis, children }) {
  const { usuario } = useAuth();
  if (!perfis.includes(usuario.perfil)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { usuario, carregando } = useAuth();
  if (carregando) return <Carregando texto="Carregando sessão…" />;
  if (!usuario) return <Login />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="solicitacoes" element={<Solicitacoes />} />
        <Route
          path="solicitacoes/nova"
          element={
            <Restrito perfis={['ALUNO']}>
              <SolicitacaoForm />
            </Restrito>
          }
        />
        <Route path="solicitacoes/:id" element={<SolicitacaoDetalhe />} />
        <Route
          path="solicitacoes/:id/editar"
          element={
            <Restrito perfis={['ALUNO']}>
              <SolicitacaoForm />
            </Restrito>
          }
        />
        <Route
          path="cadastros"
          element={
            <Restrito perfis={['SECRETARIA', 'ADMIN', 'COORDENACAO']}>
              <Cadastros />
            </Restrito>
          }
        />
        <Route
          path="auditoria"
          element={
            <Restrito perfis={['ADMIN', 'COORDENACAO', 'DIRECAO']}>
              <Auditoria />
            </Restrito>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
