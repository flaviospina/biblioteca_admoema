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
// Consulta bibliográfica unificada — usa o endpoint do servidor, que
// pesquisa Google Books + Mercado Editorial (BR) + OpenLibrary e devolve
// TODAS as edições encontradas. Se o servidor falhar, consulta o
// Google Books/OpenLibrary direto do navegador (fallback).
// ------------------------------------------------------------------
export async function consultarBibliografia({ isbn, titulo, autor }) {
  const q = new URLSearchParams();
  if (isbn) q.set('isbn', isbn);
  if (titulo) q.set('titulo', titulo);
  if (autor) q.set('autor', autor);

  try {
    const r = await api(`isbn/consulta?${q}`);
    if (r.candidatos?.length) return r.candidatos;
  } catch {
    // servidor sem internet de saída ou erro — tenta direto do navegador
  }

  if (isbn) {
    try {
      const c = await buscarPorISBN(isbn);
      return [{ ...c, categorias: [] }];
    } catch {
      return [];
    }
  }
  const texto = [titulo, autor].filter(Boolean).join(' ');
  return (await buscarPorTitulo(texto)).map((c) => ({ ...c, categorias: [] }));
}

// ------------------------------------------------------------------
// Busca de dados bibliográficos por ISBN (Google Books → OpenLibrary)
// Fallback direto do navegador, usado quando o servidor não responde.
// ------------------------------------------------------------------
export async function buscarPorISBN(isbnBruto) {
  const isbn = String(isbnBruto).replace(/[^0-9Xx]/g, '');
  if (isbn.length < 10) throw new Error('ISBN incompleto.');

  // 1ª fonte: BrasilAPI (CBL — registro oficial de ISBN do Brasil)
  try {
    const r = await fetch(`https://brasilapi.com.br/api/isbn/v1/${isbn}`);
    if (r.ok) {
      const j = await r.json();
      if (j?.title) {
        return {
          fonte: 'BrasilAPI/CBL',
          isbn: j.isbn || isbn,
          titulo: j.title,
          subtitulo: j.subtitle || '',
          autor: (j.authors || []).join(', '),
          editora: j.publisher || '',
          ano_publicacao: j.year || '',
          paginas: j.page_count || '',
          idioma: 'Português',
          sinopse: j.synopsis || '',
          capa_url: j.cover_url || `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`,
        };
      }
    }
  } catch {
    // segue para a próxima fonte
  }

  // 2ª fonte: Google Books
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

  // 3ª fonte: OpenLibrary
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

// ------------------------------------------------------------------
// Busca por texto (usada pela foto da capa, após o OCR): devolve uma
// lista de candidatos do Google Books para o usuário confirmar.
// ------------------------------------------------------------------
export async function buscarPorTitulo(texto) {
  const consulta = encodeURIComponent(texto.trim());
  if (!consulta) return [];
  const r = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=${consulta}&maxResults=6&printType=books`
  );
  const j = await r.json();
  return (j?.items || []).map((item) => {
    const v = item.volumeInfo || {};
    const isbn = (v.industryIdentifiers || []).find((i) => i.type === 'ISBN_13')?.identifier
      || (v.industryIdentifiers || []).find((i) => i.type === 'ISBN_10')?.identifier
      || '';
    return {
      isbn,
      titulo: v.title || '',
      subtitulo: v.subtitle || '',
      autor: (v.authors || []).join(', '),
      editora: v.publisher || '',
      ano_publicacao: v.publishedDate ? parseInt(v.publishedDate.slice(0, 4), 10) : '',
      paginas: v.pageCount || '',
      idioma: v.language === 'pt' ? 'Português' : v.language === 'en' ? 'Inglês' : v.language === 'es' ? 'Espanhol' : (v.language || 'Português'),
      sinopse: v.description || '',
      capa_url: v.imageLinks?.thumbnail?.replace('http://', 'https://') || '',
    };
  }).filter((c) => c.titulo);
}

export const formatarData = (d) => {
  if (!d) return '—';
  const data = new Date(String(d).replace(' ', 'T'));
  return Number.isNaN(data.getTime()) ? '—' : data.toLocaleDateString('pt-BR');
};

export const LOGO_URL = 'https://admoema.com.br/biblioteca/assets/images/logo.png';
