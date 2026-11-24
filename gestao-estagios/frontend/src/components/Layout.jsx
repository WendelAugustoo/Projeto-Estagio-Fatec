import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../services/auth';
import { PERFIL_ROTULO } from '../services/format';

function menuDoPerfil(perfil) {
  const itens = [{ para: '/', rotulo: 'Painel', fim: true }];
  if (perfil === 'ALUNO') {
    itens.push({ para: '/solicitacoes', rotulo: 'Minhas solicitações' }, { para: '/solicitacoes/nova', rotulo: 'Nova solicitação' });
  } else if (perfil === 'ADMIN') {
    itens.push({ para: '/solicitacoes', rotulo: 'Solicitações (consulta)' });
  } else {
    itens.push({ para: '/solicitacoes?fila=1', rotulo: 'Minha fila' }, { para: '/solicitacoes', rotulo: 'Pesquisar solicitações' });
  }
  if (['SECRETARIA', 'ADMIN', 'COORDENACAO'].includes(perfil)) itens.push({ para: '/cadastros', rotulo: 'Cadastros' });
  if (['ADMIN', 'COORDENACAO', 'DIRECAO'].includes(perfil)) itens.push({ para: '/auditoria', rotulo: 'Auditoria' });
  return itens;
}

export default function Layout() {
  const { usuario, sair } = useAuth();
  const [menuAberto, setMenuAberto] = useState(false);
  const local = useLocation();
  const itens = menuDoPerfil(usuario.perfil);
  const ativo = (item) => {
    const [caminho, busca] = item.para.split('?');
    if (item.fim) return local.pathname === caminho;
    if (caminho === '/solicitacoes') {
      const fila = new URLSearchParams(local.search).get('fila') === '1';
      return local.pathname === '/solicitacoes' && fila === Boolean(busca);
    }
    return local.pathname.startsWith(caminho);
  };

  return (
    <div className="app">
      <a href="#conteudo" className="pular">
        Ir para o conteúdo
      </a>
      <header className="topo">
        <button className="botao-menu" aria-expanded={menuAberto} aria-controls="menu-lateral" onClick={() => setMenuAberto((v) => !v)}>
          <span aria-hidden="true">☰</span>
          <span className="sr-only">Menu</span>
        </button>
        <div className="marca">
          <span className="marca-logo" aria-hidden="true">
            E
          </span>
          <div>
            <strong>Gestão de Estágios</strong>
            <small>Projeto acadêmico demonstrativo</small>
          </div>
        </div>
        <div className="usuario-topo">
          <div className="usuario-info">
            <strong>{usuario.nome}</strong>
            <small>{PERFIL_ROTULO[usuario.perfil]}</small>
          </div>
          <button className="botao botao-secundario botao-pequeno" onClick={sair}>
            Sair
          </button>
        </div>
      </header>
      <div className="corpo">
        <nav id="menu-lateral" className={`menu ${menuAberto ? 'aberto' : ''}`} aria-label="Navegação principal">
          <ul>
            {itens.map((item) => (
              <li key={item.para}>
                <NavLink to={item.para} className={() => (ativo(item) ? 'ativo' : '')} onClick={() => setMenuAberto(false)} end={item.fim}>
                  {item.rotulo}
                </NavLink>
              </li>
            ))}
          </ul>
          <p className="aviso-menu">Sistema demonstrativo: não substitui SEI, assinatura eletrônica oficial ou deliberações da CESU.</p>
        </nav>
        <main id="conteudo" className="conteudo" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
