import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { api, buscarPorTitulo, consultarBibliografia } from '../../api';
import { carregando, escolherLivro, useToast } from '../../componentes/Uteis';

// Leitura "esforçada": aceita EAN-13, EAN-8, UPC e códigos comuns em livros
const HINTS = new Map([
  [DecodeHintType.TRY_HARDER, true],
  [DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E, BarcodeFormat.CODE_39, BarcodeFormat.CODE_128, BarcodeFormat.ITF,
  ]],
]);

const FORM_VAZIO = {
  isbn: '', titulo: '', subtitulo: '', autor: '', editora: '', ano_publicacao: '',
  edicao: '', idioma: 'Português', paginas: '', sinopse: '', capa_url: '',
  categoria_id: '', localizacao: '', tags: '', destaque: false,
  quantidade_exemplares: 1, origem: 'doacao', doador: '',
};

export default function LivroForm() {
  const { id } = useParams();
  const editando = !!id;
  const navegar = useNavigate();
  const avisar = useToast();

  const [form, setForm] = useState(FORM_VAZIO);
  const [categorias, setCategorias] = useState([]);
  const [modo, setModo] = useState('digitar'); // digitar | camera
  const [buscando, setBuscando] = useState(false);
  const [fonte, setFonte] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Envio automático após leitura pela câmera (com chance de cancelar)
  const [contagem, setContagem] = useState(null);
  const contagemRef = useRef(null);

  // Scanner
  const videoRef = useRef(null);
  const leitorRef = useRef(null);
  const controlesRef = useRef(null);
  const fotoRef = useRef(null);
  const fotoModoRef = useRef('codigo'); // 'codigo' | 'capa'
  const [scannerLigado, setScannerLigado] = useState(false);

  useEffect(() => {
    api('categorias').then((r) => setCategorias(r.categorias)).catch(() => {});
    if (editando) {
      api(`livros/${id}`)
        .then(({ livro: l }) =>
          setForm({
            ...FORM_VAZIO,
            ...Object.fromEntries(Object.entries(l).filter(([k]) => k in FORM_VAZIO).map(([k, v]) => [k, v ?? ''])),
            destaque: !!Number(l.destaque),
          })
        )
        .catch((e) => setErro(e.message));
    }
    return () => pararScanner();
  }, [id]);

  const mudar = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  // ---------------------------------------------------------- Categoria automática
  const normalizar = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  const mapearCategoria = (categoriasDoLivro) => {
    const texto = normalizar((categoriasDoLivro || []).join(' '));
    if (!texto) return '';
    // 1) o nome de alguma categoria do sistema aparece no texto?
    for (const c of categorias) {
      if (texto.includes(normalizar(c.nome))) return c.id;
    }
    // 2) palavras-chave (Google Books devolve em inglês; Mercado Editorial em português)
    const regras = [
      [/teolog|theolog|doutrin|doctrin|dogmat/, 'teologia'],
      [/estudo bibl|bible stud|comentari|commentar|hermeneut|exeges/, 'estudo biblico'],
      [/famil|marria|casament|conjug/, 'familia'],
      [/infantil|children|juvenile|crianc|kids/, 'infantil'],
      [/jovem|jovens|adolescen|youth|young adult|teen/, 'jovens e adolescentes'],
      [/louvor|adorac|worship|music/, 'louvor e adoracao'],
      [/biografi|biograph|missionar|missio|missao|missoes/, 'biografias e missoes'],
      [/escola bibl|sunday school|\bebd\b/, 'escola biblica dominical'],
      [/fiction|romance|literatur|poesia|poetry|novel|conto/, 'literatura geral'],
      [/religi|christian|crist|espiritual|devocion|gospel|bibli|bible|igreja|church|orac|prayer|\bfe\b|faith|deus|god/, 'vida crista'],
    ];
    for (const [re, alvo] of regras) {
      if (re.test(texto)) {
        const c = categorias.find((x) => normalizar(x.nome) === alvo);
        if (c) return c.id;
      }
    }
    return '';
  };

  // ---------------------------------------------------------- Aplicar candidato escolhido
  const aplicar = (c, { autoEnviar = false } = {}) => {
    setForm((f) => {
      const novo = {
        ...f,
        ...Object.fromEntries(
          Object.entries(c).filter(([k, v]) => k !== 'fonte' && k !== 'categorias' && v !== '' && v != null)
        ),
      };
      if (!novo.categoria_id) {
        novo.categoria_id = mapearCategoria([...(c.categorias || []), c.titulo, c.subtitulo]);
      }
      return novo;
    });
    setFonte(c.fonte || 'internet');
    if (autoEnviar) iniciarContagem();
  };

  // ---------------------------------------------------------- Busca por ISBN/EAN
  const preencherPorISBN = async (isbn, { autoEnviar = false } = {}) => {
    setBuscando(true);
    setErro('');
    const janela = carregando('Consultando o código…', `Pesquisando ${isbn} no Google Books, Mercado Editorial e OpenLibrary.`);
    try {
      const encontrados = await consultarBibliografia({ isbn });
      janela.fechar();
      if (encontrados.length === 0) {
        setErro(`Nenhum livro encontrado para o código ${isbn}. Tente a busca por título/autor ou preencha manualmente.`);
        setForm((f) => ({ ...f, isbn: String(isbn) }));
        return;
      }
      if (encontrados.length === 1) {
        aplicar(encontrados[0], { autoEnviar });
        avisar(`Dados encontrados no ${encontrados[0].fonte}!`);
        return;
      }
      // Mais de uma edição: o usuário escolhe no modal
      const escolhido = await escolherLivro(encontrados, `${encontrados.length} edições encontradas — qual é a sua?`);
      if (escolhido) {
        aplicar(escolhido, { autoEnviar });
      } else {
        setForm((f) => ({ ...f, isbn: String(isbn) }));
      }
    } catch (e) {
      janela.fechar();
      setErro(e.message);
      setForm((f) => ({ ...f, isbn: String(isbn) }));
    } finally {
      setBuscando(false);
    }
  };

  // ---------------------------------------------------------- Busca por título/autor
  const [buscaTitulo, setBuscaTitulo] = useState('');
  const [buscaAutor, setBuscaAutor] = useState('');
  const buscarPorTituloAutor = async () => {
    if (!buscaTitulo && !buscaAutor) return;
    setErro('');
    const janela = carregando('Buscando na internet…', [buscaTitulo, buscaAutor].filter(Boolean).join(' — '));
    try {
      const encontrados = await consultarBibliografia({ titulo: buscaTitulo, autor: buscaAutor });
      janela.fechar();
      if (encontrados.length === 0) {
        setErro('Nenhum livro encontrado. Confira a grafia ou preencha o formulário manualmente.');
        return;
      }
      const escolhido = encontrados.length === 1
        ? encontrados[0]
        : await escolherLivro(encontrados, `${encontrados.length} livros encontrados — escolha o correto`);
      if (escolhido) {
        aplicar(escolhido);
        avisar(`Formulário preenchido via ${escolhido.fonte}. Revise e cadastre!`);
      }
    } catch (e) {
      janela.fechar();
      setErro(e.message);
    }
  };

  // ---------------------------------------------------------- Envio automático
  const iniciarContagem = () => {
    cancelarContagem();
    let restante = 5;
    setContagem(restante);
    contagemRef.current = setInterval(() => {
      restante -= 1;
      if (restante <= 0) {
        cancelarContagem();
        document.getElementById('form-livro')?.requestSubmit();
      } else {
        setContagem(restante);
      }
    }, 1000);
  };

  const cancelarContagem = () => {
    if (contagemRef.current) clearInterval(contagemRef.current);
    contagemRef.current = null;
    setContagem(null);
  };

  // ---------------------------------------------------------- Scanner (câmera ao vivo)
  const aoLerCodigo = (resultado) => {
    if (!resultado) return;
    const codigo = resultado.getText().replace(/[^0-9Xx]/g, '');
    // Aceita ISBN-13, ISBN-10 e qualquer EAN-13 (alguns livros usam EAN próprio)
    if (codigo.length !== 13 && codigo.length !== 10 && codigo.length !== 8) return;
    pararScanner();
    preencherPorISBN(codigo, { autoEnviar: true });
  };

  const ligarScanner = async () => {
    setErro('');
    setScannerLigado(true);
    try {
      leitorRef.current = leitorRef.current || new BrowserMultiFormatReader(HINTS);
      // Aguarda o <video> montar no DOM antes de ligar o stream
      await new Promise((r) => setTimeout(r, 50));
      try {
        // 1ª tentativa: câmera traseira do celular, em boa resolução
        controlesRef.current = await leitorRef.current.decodeFromConstraints(
          {
            audio: false,
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          },
          videoRef.current,
          aoLerCodigo
        );
      } catch {
        // 2ª tentativa: qualquer câmera disponível (notebooks, tablets…)
        controlesRef.current = await leitorRef.current.decodeFromConstraints(
          { audio: false, video: true },
          videoRef.current,
          aoLerCodigo
        );
      }
      // Alguns navegadores (iOS/Android antigos) não iniciam o vídeo sozinhos
      await videoRef.current?.play?.().catch(() => {});
    } catch (e) {
      setScannerLigado(false);
      setErro(
        'Não foi possível acessar a câmera. Verifique a permissão do navegador ' +
        '(a câmera exige conexão HTTPS) ou envie uma foto do código de barras abaixo.'
      );
    }
  };

  const pararScanner = () => {
    controlesRef.current?.stop();
    controlesRef.current = null;
    setScannerLigado(false);
  };

  // ---------------------------------------------------------- Foto tirada com o celular
  const abrirFoto = (modo) => {
    fotoModoRef.current = modo;
    fotoRef.current?.click();
  };

  /**
   * Decodifica o código de barras de uma FOTO com modo "esforçado":
   * testa a imagem inteira, ampliada, em 4 rotações e recortada na
   * faixa central — fotos de celular raramente vêm perfeitamente retas.
   */
  const decodificarFotoCodigo = async (arquivo) => {
    const leitor = new BrowserMultiFormatReader(HINTS);
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('Não foi possível abrir a imagem.'));
      i.src = URL.createObjectURL(arquivo);
    });
    try {
      const variacoes = [];
      for (const rot of [0, 90, 180, 270]) variacoes.push({ rot, recorte: false });
      for (const rot of [0, 90]) variacoes.push({ rot, recorte: true });

      for (const { rot, recorte } of variacoes) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const girado = rot === 90 || rot === 270;
        const maxLado = 1600;
        const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
        let w = Math.round(img.width * escala);
        let h = Math.round(img.height * escala);
        canvas.width = girado ? h : w;
        canvas.height = girado ? w : h;
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rot * Math.PI) / 180);
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        ctx.restore();

        if (recorte) {
          // Mantém apenas a faixa central horizontal (onde o código costuma estar)
          const faixa = document.createElement('canvas');
          faixa.width = canvas.width;
          faixa.height = Math.round(canvas.height * 0.45);
          faixa.getContext('2d').drawImage(
            canvas, 0, Math.round(canvas.height * 0.275), canvas.width, faixa.height,
            0, 0, faixa.width, faixa.height
          );
          try { return (await leitor.decodeFromCanvas(faixa)).getText(); } catch { /* próxima variação */ }
        } else {
          try { return (await leitor.decodeFromCanvas(canvas)).getText(); } catch { /* próxima variação */ }
        }
      }
      throw new Error('Código de barras não encontrado na foto.');
    } finally {
      URL.revokeObjectURL(img.src);
    }
  };

  const lerFoto = async (e) => {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    setErro('');
    pararScanner();

    if (fotoModoRef.current === 'capa') {
      await lerFotoDaCapa(arquivo);
      return;
    }

    // Modo código de barras: leitura reforçada; se não achar, cai para a capa
    const janela = carregando('Lendo o código de barras da foto…');
    try {
      const texto = await decodificarFotoCodigo(arquivo);
      const codigo = texto.replace(/[^0-9Xx]/g, '');
      janela.fechar();
      if (codigo.length < 8) throw new Error('Código ilegível.');
      await preencherPorISBN(codigo, { autoEnviar: true });
    } catch {
      janela.fechar();
      await avisar('Nenhum código de barras legível na foto — vou tentar reconhecer a capa…', 'ok');
      await lerFotoDaCapa(arquivo);
    }
  };

  // ---------------------------------------------------------- Foto da CAPA (OCR + busca)
  const lerFotoDaCapa = async (arquivo) => {
    const janela = carregando('Lendo a capa do livro…', 'Preparando o reconhecimento de texto (a primeira vez demora um pouco mais).');
    try {
      const { default: Tesseract } = await import('tesseract.js');
      const { data } = await Tesseract.recognize(arquivo, 'por', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            janela.atualizar(`Reconhecendo o texto da capa… ${Math.round(m.progress * 100)}%`);
          }
        },
      });

      // Extrai as palavras mais prováveis do título (ignora ruído do OCR)
      const palavras = (data.text || '')
        .split(/\s+/)
        .map((p) => p.replace(/[^\p{L}\p{N}'-]/gu, ''))
        .filter((p) => p.length >= 3)
        .slice(0, 10);
      if (palavras.length === 0) {
        throw new Error('Não consegui ler texto na capa. Tente uma foto mais próxima, reta e bem iluminada.');
      }

      janela.atualizar('Consultando a internet…');
      let resultados = await consultarBibliografia({ titulo: palavras.join(' ') });
      if (resultados.length === 0) {
        resultados = (await buscarPorTitulo(palavras.join(' '))).map((c) => ({ ...c, categorias: [] }));
      }
      janela.fechar();

      if (resultados.length === 0) {
        setErro(`Nenhum livro encontrado para "${palavras.join(' ')}". Tente a foto do código de barras ou digite o ISBN.`);
        return;
      }
      const escolhido = resultados.length === 1
        ? resultados[0]
        : await escolherLivro(resultados, 'Qual destes é o livro da foto?');
      if (escolhido) aplicar(escolhido, { autoEnviar: true });
    } catch (e) {
      janela.fechar();
      setErro(e.message || 'Não foi possível reconhecer a capa. Tente o código de barras ou digite o ISBN.');
    }
  };

  // ---------------------------------------------------------- Salvar
  const salvar = async (e) => {
    e.preventDefault();
    cancelarContagem();
    setSalvando(true);
    setErro('');
    try {
      const body = { ...form, destaque: form.destaque ? 1 : 0 };
      if (editando) {
        await api(`livros/${id}`, { method: 'PUT', body });
        avisar('Livro atualizado!');
        navegar(`/livro/${id}`);
      } else {
        const r = await api('livros', { method: 'POST', body });
        avisar(
          r.ja_existia
            ? `Este ISBN já existia — ${r.exemplares_criados.length} exemplar(es) adicionados ao título.`
            : `Livro cadastrado! Tombo(s): ${r.exemplares_criados.join(', ')}`
        );
        navegar(`/livro/${r.id}`);
      }
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <div className="pagina-cabecalho">
        <div>
          <h1>{editando ? 'Editar livro' : 'Cadastrar livro'}</h1>
          <p>
            {editando
              ? 'Ajuste os dados bibliográficos do título.'
              : 'Digite o ISBN/EAN, busque por título/autor ou use a câmera — o sistema consulta 3 catálogos na internet e preenche o formulário sozinho.'}
          </p>
        </div>
        <Link to="/admin/livros" className="botao secundario">← Acervo</Link>
      </div>

      {!editando && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="abas" style={{ maxWidth: 560 }}>
            <button type="button" className={modo === 'digitar' ? 'ativa' : ''} onClick={() => { setModo('digitar'); pararScanner(); }}>
              ⌨️ ISBN / EAN
            </button>
            <button type="button" className={modo === 'buscar' ? 'ativa' : ''} onClick={() => { setModo('buscar'); pararScanner(); }}>
              🔎 Título / Autor
            </button>
            <button type="button" className={modo === 'camera' ? 'ativa' : ''} onClick={() => setModo('camera')}>
              📷 Usar câmera
            </button>
          </div>

          {modo === 'digitar' && (
            <form
              style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
              onSubmit={(e) => { e.preventDefault(); form.isbn && preencherPorISBN(form.isbn); }}
            >
              <input
                style={{ flex: '1 1 220px', padding: '10px 13px', border: '1.5px solid var(--borda)', borderRadius: 10, font: 'inherit' }}
                placeholder="Digite o ISBN ou EAN (10 ou 13 dígitos)…"
                name="isbn"
                value={form.isbn}
                onChange={mudar}
                inputMode="numeric"
              />
              <button className="botao dourado" disabled={buscando || !form.isbn}>
                {buscando ? 'Consultando…' : '🔎 Buscar dados na internet'}
              </button>
            </form>
          )}

          {modo === 'buscar' && (
            <form
              style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
              onSubmit={(e) => { e.preventDefault(); buscarPorTituloAutor(); }}
            >
              <input
                style={{ flex: '2 1 220px', padding: '10px 13px', border: '1.5px solid var(--borda)', borderRadius: 10, font: 'inherit' }}
                placeholder="Nome do livro…"
                value={buscaTitulo}
                onChange={(e) => setBuscaTitulo(e.target.value)}
              />
              <input
                style={{ flex: '1 1 180px', padding: '10px 13px', border: '1.5px solid var(--borda)', borderRadius: 10, font: 'inherit' }}
                placeholder="Autor (opcional)…"
                value={buscaAutor}
                onChange={(e) => setBuscaAutor(e.target.value)}
              />
              <button className="botao dourado" disabled={!buscaTitulo && !buscaAutor}>
                🔎 Buscar na internet
              </button>
            </form>
          )}

          {modo === 'camera' && (
            <div style={{ maxWidth: 480 }}>
              {scannerLigado ? (
                <>
                  <div className="scanner-moldura">
                    <video ref={videoRef} className="scanner-video" muted autoPlay playsInline />
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--texto-2)' }}>
                    Aponte para o código de barras do ISBN (atrás do livro). A leitura é automática.
                  </p>
                  <button type="button" className="botao secundario" onClick={pararScanner}>Parar câmera</button>
                </>
              ) : (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button type="button" className="botao dourado" onClick={ligarScanner}>📷 Escanear código ao vivo</button>
                  <button type="button" className="botao secundario" onClick={() => abrirFoto('codigo')} disabled={buscando}>
                    {buscando ? 'Lendo foto…' : '🏷️ Foto do código de barras'}
                  </button>
                  <button type="button" className="botao secundario" onClick={() => abrirFoto('capa')} disabled={buscando}>
                    🖼️ Foto da capa do livro
                  </button>
                  <input ref={fotoRef} type="file" accept="image/*" capture="environment" hidden onChange={lerFoto} />
                </div>
              )}
            </div>
          )}

          {fonte && <p style={{ marginTop: 10 }}><span className="chip ok">✓ Preenchido automaticamente via {fonte}</span></p>}
        </div>
      )}

      {contagem !== null && (
        <div className="contagem-envio">
          <span>🚀 Enviando cadastro automaticamente em {contagem}s… Confira os dados abaixo.</span>
          <button type="button" className="botao secundario pequeno" onClick={cancelarContagem}>Pausar para revisar</button>
        </div>
      )}

      {erro && <div className="aviso erro">{erro}</div>}

      <form id="form-livro" className="card" onSubmit={salvar}>
        <h2>Dados bibliográficos</h2>
        <div className="grade-form">
          <div className="campo" style={{ gridColumn: '1 / -1' }}>
            <label>Título *</label>
            <input name="titulo" value={form.titulo} onChange={mudar} required />
          </div>
          <div className="campo" style={{ gridColumn: '1 / -1' }}>
            <label>Subtítulo</label>
            <input name="subtitulo" value={form.subtitulo} onChange={mudar} />
          </div>
          <div className="campo">
            <label>Autor(es) *</label>
            <input name="autor" value={form.autor} onChange={mudar} required />
          </div>
          <div className="campo">
            <label>Editora</label>
            <input name="editora" value={form.editora} onChange={mudar} />
          </div>
          <div className="campo">
            <label>ISBN</label>
            <input name="isbn" value={form.isbn} onChange={mudar} />
          </div>
          <div className="campo">
            <label>Ano</label>
            <input name="ano_publicacao" type="number" min="1500" max="2100" value={form.ano_publicacao} onChange={mudar} />
          </div>
          <div className="campo">
            <label>Edição</label>
            <input name="edicao" value={form.edicao} onChange={mudar} placeholder="Ex.: 2ª ed." />
          </div>
          <div className="campo">
            <label>Idioma</label>
            <input name="idioma" value={form.idioma} onChange={mudar} />
          </div>
          <div className="campo">
            <label>Páginas</label>
            <input name="paginas" type="number" min="1" value={form.paginas} onChange={mudar} />
          </div>
          <div className="campo">
            <label>Categoria</label>
            <select name="categoria_id" value={form.categoria_id} onChange={mudar}>
              <option value="">— Selecionar —</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div className="campo">
            <label>Localização física</label>
            <input name="localizacao" value={form.localizacao} onChange={mudar} placeholder="Ex.: Estante B, prateleira 3" />
          </div>
          <div className="campo">
            <label>Tags (separadas por vírgula)</label>
            <input name="tags" value={form.tags} onChange={mudar} placeholder="oração, jejum, avivamento" />
          </div>
          <div className="campo" style={{ gridColumn: '1 / -1' }}>
            <label>URL da capa</label>
            <input name="capa_url" value={form.capa_url} onChange={mudar} placeholder="https://…" />
          </div>
          <div className="campo" style={{ gridColumn: '1 / -1' }}>
            <label>Sinopse</label>
            <textarea name="sinopse" value={form.sinopse} onChange={mudar} rows={4} />
          </div>
        </div>

        {form.capa_url && (
          <img src={form.capa_url} alt="Pré-visualização da capa" style={{ width: 90, borderRadius: 8, marginBottom: 14 }} onError={(e) => { e.target.style.display = 'none'; }} />
        )}

        <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 16, fontSize: '0.88rem', fontWeight: 600 }}>
          <input type="checkbox" name="destaque" checked={form.destaque} onChange={mudar} />
          ⭐ Destacar este livro no catálogo
        </label>

        {!editando && (
          <>
            <h2>Exemplares físicos</h2>
            <div className="grade-form">
              <div className="campo">
                <label>Quantidade de exemplares</label>
                <input name="quantidade_exemplares" type="number" min="1" max="50" value={form.quantidade_exemplares} onChange={mudar} />
              </div>
              <div className="campo">
                <label>Origem</label>
                <select name="origem" value={form.origem} onChange={mudar}>
                  <option value="doacao">Doação</option>
                  <option value="compra">Compra</option>
                </select>
              </div>
              {form.origem === 'doacao' && (
                <div className="campo">
                  <label>Nome do doador (opcional)</label>
                  <input name="doador" value={form.doador} onChange={mudar} />
                </div>
              )}
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--texto-3)' }}>
              O número de tombo (etiqueta) de cada exemplar é gerado automaticamente no formato MN-00000-00.
            </p>
          </>
        )}

        <button className="botao" disabled={salvando} style={{ minWidth: 200 }}>
          {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : '✚ Cadastrar no acervo'}
        </button>
      </form>
    </>
  );
}
