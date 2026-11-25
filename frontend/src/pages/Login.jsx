import { useState } from 'react';
import { useAuth } from '../services/auth';
import { Campo, ErroBox } from '../components/ui';

// Contas fictícias criadas pelo seed (senha: Senha@123)
const CONTAS_DEMO = [
  { email: 'aluno@fatec.demo', papel: 'Aluno', obs: 'Ana — sem solicitações, ideal para o fluxo completo' },
  { email: 'aluno.irregular@fatec.demo', papel: 'Aluno', obs: 'Bruno — matrícula irregular (CA-01)' },
  { email: 'aluno2@fatec.demo', papel: 'Aluno', obs: 'Carla — equiparação em curso sem previsão no PPC (CA-07)' },
  { email: 'aluno3@fatec.demo', papel: 'Aluno', obs: 'Diego — estágio em execução (horas e relatórios)' },
  { email: 'aluno4@fatec.demo', papel: 'Aluno', obs: 'Elisa — estágio em avaliação final' },
  { email: 'aluno8@fatec.demo', papel: 'Aluno', obs: 'João — prazo de correção expirado' },
  { email: 'aluno9@fatec.demo', papel: 'Aluno', obs: 'Larissa — data de início do estágio já vencida' },
  { email: 'secretaria@fatec.demo', papel: 'Secretaria', obs: '' },
  { email: 'professor@fatec.demo', papel: 'Professor', obs: 'Prof. Carlos' },
  { email: 'coordenacao@fatec.demo', papel: 'Coordenação', obs: '' },
  { email: 'direcao@fatec.demo', papel: 'Direção', obs: '' },
  { email: 'admin@fatec.demo', papel: 'Administrador', obs: '' },
];

export default function Login() {
  const { entrar, sessaoExpirada } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const submeter = async (e) => {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await entrar(email, senha);
    } catch (err) {
      setErro(err);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="login-pagina">
      <main className="login-cartao">
        <div className="marca marca-grande">
          <span className="marca-logo" aria-hidden="true">
            E
          </span>
          <div>
            <h1>Gestão de Estágios Supervisionados</h1>
            <small>Estágio regular · Equivalência · Equiparação</small>
          </div>
        </div>
        {sessaoExpirada && (
          <div className="alerta alerta-aviso" role="status">
            Sua sessão expirou. Entre novamente.
          </div>
        )}
        <form onSubmit={submeter} noValidate>
          <Campo rotulo="E-mail" obrigatorio>
            {(id) => <input id={id} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />}
          </Campo>
          <Campo rotulo="Senha" obrigatorio>
            {(id) => <input id={id} type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />}
          </Campo>
          <ErroBox erro={erro} />
          <button className="botao botao-primario botao-largo" disabled={enviando}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <details className="contas-demo">
          <summary>Contas fictícias para teste (senha: Senha@123)</summary>
          <ul>
            {CONTAS_DEMO.map((c) => (
              <li key={c.email}>
                <button
                  type="button"
                  className="link-botao"
                  onClick={() => {
                    setEmail(c.email);
                    setSenha('Senha@123');
                  }}
                >
                  <strong>{c.papel}</strong> — {c.email}
                </button>
                {c.obs && <small>{c.obs}</small>}
              </li>
            ))}
          </ul>
        </details>
        <p className="aviso-rodape">
          Protótipo acadêmico com dados fictícios. Não substitui SEI, assinatura eletrônica oficial, portal acadêmico ou deliberações da CESU.
        </p>
      </main>
    </div>
  );
}
