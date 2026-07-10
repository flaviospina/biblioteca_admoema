import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { api, buscarPorISBN, buscarPorTitulo } from '../../api';
import { Capa, Modal, carregando, useToast } from '../../componentes/Uteis';

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
  const [candidatos, setCandidatos] = useState(null); // resultados da foto da capa

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

  // ---------------------------------------------------------- Busca por ISBN
  const preencherPorISBN = async (isbn, { autoEnviar = false } = {}) => {
    setBuscando(true);
    setErro('');
    try {
      const dados = await buscarPorISBN(isbn);
      setForm((f) => ({
        ...f,
        ...Object.fromEntries(Object.entries(dados).filter(([k, v]) => k !== 'fonte' && v !== '' && v != null)),
      }));
      setFonte(dados.fonte);
      avisar(`Dados encontrados no ${dados.fonte}!`);
      if (autoEnviar) iniciarContagem();
    } catch (e) {
      setErro(e.message);
      setForm((f) => ({ ...f, isbn: String(isbn) }));
    } finally {
      setBuscando(false);
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
    // ISBN-13 começa com 978/979; aceita também ISBN-10
    if (codigo.length === 13 && !/^97[89]/.test(codigo)) return;
    if (codigo.length !== 13 && codigo.length !== 10) return;
    pararScanner();
    preencherPorISBN(codigo, { autoEnviar: true });
  };

  const ligarScanner = async () => {
    setErro('');
    setScannerLigado(true);
    try {
      leitorRef.current = leitorRef.current || new BrowserMultiFormatReader();
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

    // Modo código de barras: tenta ler o ISBN; se não achar, cai para a capa
    setBuscando(true);
    const url = URL.createObjectURL(arquivo);
    try {
      leitorRef.current = leitorRef.current || new BrowserMultiFormatReader();
      const resultado = await leitorRef.current.decodeFromImageUrl(url);
      const codigo = resultado.getText().replace(/[^0-9Xx]/g, '');
      await preencherPorISBN(codigo, { autoEnviar: true });
    } catch {
      setBuscando(false);
      avisar('Nenhum código de barras na foto — tentando reconhecer a capa…', 'ok');
      await lerFotoDaCapa(arquivo);
    } finally {
      URL.revokeObjectURL(url);
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
      const resultados = await buscarPorTitulo(palavras.join(' '));
      janela.fechar();

      if (resultados.length === 0) {
        setErro(`Nenhum livro encontrado para "${palavras.join(' ')}". Tente a foto do código de barras ou digite o ISBN.`);
        return;
      }
      setCandidatos(resultados);
    } catch (e) {
      janela.fechar();
      setErro(e.message || 'Não foi possível reconhecer a capa. Tente o código de barras ou digite o ISBN.');
    }
  };

  const aplicarCandidato = (c) => {
    setCandidatos(null);
    setForm((f) => ({
      ...f,
      ...Object.fromEntries(Object.entries(c).filter(([, v]) => v !== '' && v != null)),
    }));
    setFonte('Google Books (foto da capa)');
    iniciarContagem();
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
              : 'Digite o ISBN, aponte a câmera para o código de barras ou envie uma foto — o formulário se preenche e envia sozinho.'}
          </p>
        </div>
        <Link to="/admin/livros" className="botao secundario">← Acervo</Link>
      </div>

      {!editando && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="abas" style={{ maxWidth: 420 }}>
            <button type="button" className={modo === 'digitar' ? 'ativa' : ''} onClick={() => { setModo('digitar'); pararScanner(); }}>
              ⌨️ Digitar ISBN
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
                placeholder="Digite qualquer ISBN (10 ou 13 dígitos)…"
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

      {candidatos && (
        <Modal titulo="Qual destes é o livro?" aoFechar={() => setCandidatos(null)}>
          <p style={{ color: 'var(--texto-2)', fontSize: '0.86rem', marginTop: -6 }}>
            Encontrei estes títulos a partir da foto da capa. Toque no correto para preencher o formulário.
          </p>
          <div className="lista-simples">
            {candidatos.map((c, i) => (
              <button
                key={i}
                type="button"
                className="item-linha"
                style={{ cursor: 'pointer', textAlign: 'left', font: 'inherit' }}
                onClick={() => aplicarCandidato(c)}
              >
                <Capa url={c.capa_url} titulo={c.titulo} />
                <div className="principal">
                  <div className="t">{c.titulo}</div>
                  <div className="s">{c.autor}{c.editora ? ` · ${c.editora}` : ''}{c.ano_publicacao ? ` · ${c.ano_publicacao}` : ''}</div>
                </div>
                <span className="chip">usar</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
