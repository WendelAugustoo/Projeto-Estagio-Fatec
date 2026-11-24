const BASE = import.meta.env.VITE_API_BASE || '/api';
const CHAVE_TOKEN = 'estagios.token';

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details || [];
  }
}

export const tokenStore = {
  get: () => sessionStorage.getItem(CHAVE_TOKEN),
  set: (t) => sessionStorage.setItem(CHAVE_TOKEN, t),
  clear: () => sessionStorage.removeItem(CHAVE_TOKEN),
};

let aoExpirar = () => {};
export const definirAoExpirar = (fn) => {
  aoExpirar = fn;
};

async function requisicao(metodo, rota, corpo) {
  const headers = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (corpo instanceof FormData) body = corpo;
  else if (corpo !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(corpo);
  }
  let res;
  try {
    res = await fetch(BASE + rota, { method: metodo, headers, body });
  } catch {
    throw new ApiError(0, 'Não foi possível conectar ao servidor. Verifique se o backend está em execução.');
  }
  if (res.status === 401 && rota !== '/auth/login') {
    tokenStore.clear();
    aoExpirar();
  }
  const tipo = res.headers.get('content-type') || '';
  const dados = tipo.includes('application/json') ? await res.json() : null;
  if (!res.ok) {
    throw new ApiError(res.status, dados?.error?.message || `Erro ${res.status}`, dados?.error?.details);
  }
  return dados;
}

export const api = {
  get: (r) => requisicao('GET', r),
  post: (r, c = {}) => requisicao('POST', r, c),
  put: (r, c) => requisicao('PUT', r, c),
  patch: (r, c) => requisicao('PATCH', r, c),
};

/** Baixa um arquivo protegido (documento ou PDF) usando o token da sessão. */
export async function baixarArquivo(rota, nomePadrao) {
  const res = await fetch(BASE + rota, { headers: { Authorization: `Bearer ${tokenStore.get()}` } });
  if (!res.ok) {
    const dados = await res.json().catch(() => null);
    throw new ApiError(res.status, dados?.error?.message || 'Não foi possível baixar o arquivo.');
  }
  const disp = res.headers.get('content-disposition') || '';
  const m = /filename\*=UTF-8''([^;]+)/.exec(disp) || /filename="([^"]+)"/.exec(disp);
  const nome = m ? decodeURIComponent(m[1]) : nomePadrao;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
