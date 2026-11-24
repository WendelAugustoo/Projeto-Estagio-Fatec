import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, definirAoExpirar, tokenStore } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [dominios, setDominios] = useState(null);
  const [carregando, setCarregando] = useState(Boolean(tokenStore.get()));
  const [sessaoExpirada, setSessaoExpirada] = useState(false);

  const carregarSessao = useCallback(async () => {
    const [me, dom] = await Promise.all([api.get('/auth/me'), api.get('/dominios')]);
    setUsuario(me);
    setDominios(dom);
  }, []);

  useEffect(() => {
    definirAoExpirar(() => {
      setUsuario(null);
      setSessaoExpirada(true);
    });
    if (tokenStore.get()) {
      carregarSessao()
        .catch(() => tokenStore.clear())
        .finally(() => setCarregando(false));
    }
  }, [carregarSessao]);

  const entrar = async (email, senha) => {
    const { token } = await api.post('/auth/login', { email, senha });
    tokenStore.set(token);
    setSessaoExpirada(false);
    await carregarSessao();
  };

  const sair = () => {
    tokenStore.clear();
    setUsuario(null);
  };

  return (
    <AuthContext.Provider value={{ usuario, dominios, carregando, entrar, sair, sessaoExpirada, recarregar: carregarSessao }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
