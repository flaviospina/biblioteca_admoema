// Cliente HTTP da API — anexa o token e trata erros de forma uniforme.

const BASE = import.meta.env.DEV
  ? '/biblioteca_digital/api'
  : `${import.meta.env.BASE_URL}api`;

export function getToken() {
  return localStorage.getItem('mana_token');
}

export function setSessao(token, usuario) {
  localStorage.setItem('mana_token', token);
  localStorage.setItem('mana_usuario', JSON.stringify(usuario));
}

export function limparSessao() {
  localStorage.removeItem('mana_token');
  localStorage.removeItem('mana_usuario');
}

export async function api(rota, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const resposta = await fetch(`${BASE}/${rota}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let dados = null;
  try {
    dados = await resposta.json();
  } catch {
    throw new Error('Resposta inválida do servidor. Verifique a conexão com a API.');
  }

  if (!resposta.ok) {
    if (resposta.status === 401) {
      limparSessao();
      window.dispatchEvent(new Event('mana:sessao-expirada'));
    }
    throw new Error(dados?.erro || `Erro ${resposta.status}`);
  }
  return dados;
}

// ------------------------------------------------------------------
// Busca de dados bibliográficos por ISBN (Google Books → OpenLibrary)
// Usada pelo cadastro com preenchimento automático (digitado ou via foto).
// ------------------------------------------------------------------
export async function buscarPorISBN(isbnBruto) {
  const isbn = String(isbnBruto).replace(/[^0-9Xx]/g, '');
  if (isbn.length < 10) throw new Error('ISBN incompleto.');

  // 1ª fonte: Google Books
  try {
    const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
    const j = await r.json();
    const v = j?.items?.[0]?.volumeInfo;
    if (v) {
      return {
        fonte: 'Google Books',
        isbn,
        titulo: v.title || '',
        subtitulo: v.subtitle || '',
        autor: (v.authors || []).join(', '),
        editora: v.publisher || '',
        ano_publicacao: v.publishedDate ? parseInt(v.publishedDate.slice(0, 4), 10) : '',
        paginas: v.pageCount || '',
        idioma: v.language === 'pt' ? 'Português' : v.language === 'en' ? 'Inglês' : v.language === 'es' ? 'Espanhol' : (v.language || 'Português'),
        sinopse: v.description || '',
        capa_url:
          v.imageLinks?.thumbnail?.replace('http://', 'https://') ||
          `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`,
      };
    }
  } catch {
    // segue para a próxima fonte
  }

  // 2ª fonte: OpenLibrary
  const r = await fetch(
    `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
  );
  const j = await r.json();
  const d = j?.[`ISBN:${isbn}`];
  if (!d) throw new Error(`Nenhuma informação encontrada para o ISBN ${isbn}. Preencha manualmente.`);

  return {
    fonte: 'OpenLibrary',
    isbn,
    titulo: d.title || '',
    subtitulo: d.subtitle || '',
    autor: (d.authors || []).map((a) => a.name).join(', '),
    editora: (d.publishers || []).map((p) => p.name).join(', '),
    ano_publicacao: d.publish_date ? parseInt(String(d.publish_date).match(/\d{4}/)?.[0] || '', 10) || '' : '',
    paginas: d.number_of_pages || '',
    idioma: 'Português',
    sinopse: '',
    capa_url: d.cover?.medium || `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`,
  };
}

export const formatarData = (d) => {
  if (!d) return '—';
  const data = new Date(String(d).replace(' ', 'T'));
  return Number.isNaN(data.getTime()) ? '—' : data.toLocaleDateString('pt-BR');
};

export const LOGO_URL = 'https://admoema.com.br/biblioteca/assets/images/logo.png';
