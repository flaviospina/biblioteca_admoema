<?php
/**
 * Rota: GET /api/isbn/consulta — pesquisa bibliográfica na internet
 *
 * Parâmetros:
 *   ?isbn=...                 → busca por ISBN/EAN (10 ou 13 dígitos)
 *   ?titulo=...&autor=...     → busca por título e/ou autor
 *
 * Consulta várias fontes no servidor (sem problema de CORS no navegador):
 *   1. Google Books (país BR)   2. Mercado Editorial (catálogo brasileiro)
 *   3. OpenLibrary
 * Mescla e deduplica os resultados; o frontend exibe as opções num modal.
 */

exigir_papel('bibliotecario');

$acao = $segmentos[1] ?? '';
if ($METODO !== 'GET' || $acao !== 'consulta') {
    responder(405, ['erro' => 'Use GET /api/isbn/consulta']);
}

// ---------------------------------------------------------------- HTTP client
function http_json(string $url, int $timeout = 8): ?array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT        => $timeout,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_USERAGENT      => 'ManaBibliotecaDigital/1.0 (+https://www.admoema.com.br)',
        CURLOPT_HTTPHEADER     => ['Accept: application/json'],
    ]);
    // Em ambientes atrás de proxy (desenvolvimento), respeita HTTPS_PROXY
    $proxy = getenv('HTTPS_PROXY') ?: getenv('https_proxy');
    if ($proxy) {
        curl_setopt($ch, CURLOPT_PROXY, $proxy);
        $ca = getenv('CURL_CA_BUNDLE');
        if ($ca) curl_setopt($ch, CURLOPT_CAINFO, $ca);
    }
    $corpo = curl_exec($ch);
    curl_close($ch);
    if ($corpo === false) return null;
    $json = json_decode($corpo, true);
    return is_array($json) ? $json : null;
}

// ---------------------------------------------------------------- ISBN 10 ⇄ 13
function isbn_limpar(string $s): string
{
    return strtoupper(preg_replace('/[^0-9Xx]/', '', $s));
}

function isbn10_para_13(string $isbn10): ?string
{
    if (strlen($isbn10) !== 10) return null;
    $nucleo = '978' . substr($isbn10, 0, 9);
    $soma = 0;
    for ($i = 0; $i < 12; $i++) {
        $soma += (int)$nucleo[$i] * ($i % 2 === 0 ? 1 : 3);
    }
    return $nucleo . ((10 - $soma % 10) % 10);
}

function isbn13_para_10(string $isbn13): ?string
{
    if (strlen($isbn13) !== 13 || !str_starts_with($isbn13, '978')) return null;
    $nucleo = substr($isbn13, 3, 9);
    $soma = 0;
    for ($i = 0; $i < 9; $i++) {
        $soma += (int)$nucleo[$i] * (10 - $i);
    }
    $dv = (11 - $soma % 11) % 11;
    return $nucleo . ($dv === 10 ? 'X' : (string)$dv);
}

// ---------------------------------------------------------------- Normalização
function idioma_br(?string $codigo): string
{
    return match (strtolower(substr((string)$codigo, 0, 2))) {
        'pt' => 'Português',
        'en' => 'Inglês',
        'es' => 'Espanhol',
        'fr' => 'Francês',
        'de' => 'Alemão',
        default => $codigo ? ucfirst($codigo) : 'Português',
    };
}

function candidato(array $c): array
{
    return [
        'isbn'            => $c['isbn'] ?? '',
        'titulo'          => trim($c['titulo'] ?? ''),
        'subtitulo'       => trim($c['subtitulo'] ?? ''),
        'autor'           => trim($c['autor'] ?? ''),
        'editora'         => trim($c['editora'] ?? ''),
        'ano_publicacao'  => $c['ano_publicacao'] ?? '',
        'edicao'          => $c['edicao'] ?? '',
        'paginas'         => $c['paginas'] ?? '',
        'idioma'          => $c['idioma'] ?? 'Português',
        'sinopse'         => trim($c['sinopse'] ?? ''),
        'capa_url'        => $c['capa_url'] ?? '',
        'categorias'      => $c['categorias'] ?? [],
        'fonte'           => $c['fonte'] ?? '',
    ];
}

// ---------------------------------------------------------------- Fontes
function fonte_google_books(string $consulta): array
{
    $j = http_json('https://www.googleapis.com/books/v1/volumes?q=' . urlencode($consulta) . '&maxResults=20&printType=books&country=BR');
    $itens = [];
    foreach ($j['items'] ?? [] as $item) {
        $v = $item['volumeInfo'] ?? [];
        $isbn = '';
        foreach ($v['industryIdentifiers'] ?? [] as $id) {
            if ($id['type'] === 'ISBN_13') { $isbn = $id['identifier']; break; }
            if ($id['type'] === 'ISBN_10') $isbn = $id['identifier'];
        }
        if (empty($v['title'])) continue;
        $itens[] = candidato([
            'isbn'           => $isbn,
            'titulo'         => $v['title'],
            'subtitulo'      => $v['subtitle'] ?? '',
            'autor'          => implode(', ', $v['authors'] ?? []),
            'editora'        => $v['publisher'] ?? '',
            'ano_publicacao' => isset($v['publishedDate']) ? (int)substr($v['publishedDate'], 0, 4) : '',
            'paginas'        => $v['pageCount'] ?? '',
            'idioma'         => idioma_br($v['language'] ?? null),
            'sinopse'        => $v['description'] ?? '',
            'capa_url'       => isset($v['imageLinks']['thumbnail'])
                                  ? str_replace('http://', 'https://', $v['imageLinks']['thumbnail']) : '',
            'categorias'     => $v['categories'] ?? [],
            'fonte'          => 'Google Books',
        ]);
    }
    return $itens;
}

function fonte_mercado_editorial(string $isbn): array
{
    $j = http_json('https://api.mercadoeditorial.org/api/v1.2/book?isbn=' . urlencode($isbn));
    $itens = [];
    foreach ($j['books'] ?? [] as $b) {
        if (empty($b['titulo'])) continue;
        $autores = [];
        foreach ($b['contribuicao'] ?? [] as $c) {
            $nome = trim(($c['nome'] ?? '') . ' ' . ($c['sobrenome'] ?? ''));
            if ($nome) $autores[] = $nome;
        }
        $itens[] = candidato([
            'isbn'           => $b['isbn'] ?? $isbn,
            'titulo'         => $b['titulo'],
            'subtitulo'      => $b['subtitulo'] ?? '',
            'autor'          => implode(', ', $autores),
            'editora'        => $b['editora']['nome_fantasia'] ?? ($b['editora']['razao_social'] ?? ''),
            'ano_publicacao' => isset($b['data_publicacao']) ? (int)substr($b['data_publicacao'], 0, 4) : '',
            'edicao'         => $b['edicao'] ?? '',
            'paginas'        => $b['paginas'] ?? '',
            'idioma'         => 'Português',
            'sinopse'        => $b['sinopse'] ?? '',
            'capa_url'       => $b['imagens']['imagem_primeira_capa']['media'] ?? '',
            'categorias'     => array_values(array_filter([$b['catalogacao']['palavras_chave'] ?? null])),
            'fonte'          => 'Mercado Editorial (BR)',
        ]);
    }
    return $itens;
}

function fonte_openlibrary_isbn(string $isbn): array
{
    $j = http_json('https://openlibrary.org/api/books?bibkeys=ISBN:' . urlencode($isbn) . '&format=json&jscmd=data');
    $d = $j["ISBN:$isbn"] ?? null;
    if (!$d || empty($d['title'])) return [];
    return [candidato([
        'isbn'           => $isbn,
        'titulo'         => $d['title'],
        'subtitulo'      => $d['subtitle'] ?? '',
        'autor'          => implode(', ', array_map(fn($a) => $a['name'], $d['authors'] ?? [])),
        'editora'        => implode(', ', array_map(fn($p) => $p['name'], $d['publishers'] ?? [])),
        'ano_publicacao' => preg_match('/\d{4}/', $d['publish_date'] ?? '', $m) ? (int)$m[0] : '',
        'paginas'        => $d['number_of_pages'] ?? '',
        'capa_url'       => $d['cover']['medium'] ?? "https://covers.openlibrary.org/b/isbn/$isbn-M.jpg",
        'categorias'     => array_slice(array_map(fn($s) => $s['name'], $d['subjects'] ?? []), 0, 5),
        'fonte'          => 'OpenLibrary',
    ])];
}

function fonte_openlibrary_busca(string $titulo, string $autor): array
{
    $q = 'https://openlibrary.org/search.json?limit=10'
       . ($titulo ? '&title=' . urlencode($titulo) : '')
       . ($autor ? '&author=' . urlencode($autor) : '');
    $j = http_json($q);
    $itens = [];
    foreach (array_slice($j['docs'] ?? [], 0, 10) as $d) {
        if (empty($d['title'])) continue;
        $isbn = $d['isbn'][0] ?? '';
        $itens[] = candidato([
            'isbn'           => $isbn,
            'titulo'         => $d['title'],
            'autor'          => implode(', ', $d['author_name'] ?? []),
            'editora'        => $d['publisher'][0] ?? '',
            'ano_publicacao' => $d['first_publish_year'] ?? '',
            'paginas'        => $d['number_of_pages_median'] ?? '',
            'capa_url'       => isset($d['cover_i'])
                                  ? "https://covers.openlibrary.org/b/id/{$d['cover_i']}-M.jpg"
                                  : ($isbn ? "https://covers.openlibrary.org/b/isbn/$isbn-M.jpg" : ''),
            'fonte'          => 'OpenLibrary',
        ]);
    }
    return $itens;
}

// ---------------------------------------------------------------- Execução
$candidatos = [];

if (!empty($_GET['isbn'])) {
    $isbn = isbn_limpar($_GET['isbn']);
    if (strlen($isbn) < 10) responder(422, ['erro' => 'Informe um ISBN/EAN com 10 ou 13 dígitos.']);

    // Consulta o código nas DUAS formas (10 e 13), pois cada fonte indexa diferente
    $formas = [$isbn];
    if (strlen($isbn) === 10 && ($i13 = isbn10_para_13($isbn))) $formas[] = $i13;
    if (strlen($isbn) === 13 && ($i10 = isbn13_para_10($isbn))) $formas[] = $i10;

    foreach ($formas as $forma) {
        $candidatos = array_merge($candidatos, fonte_google_books('isbn:' . $forma));
        $candidatos = array_merge($candidatos, fonte_mercado_editorial($forma));
    }
    $candidatos = array_merge($candidatos, fonte_openlibrary_isbn($formas[count($formas) - 1]));

    // Último recurso: busca livre pelo número (acha EANs fora do padrão 978/979)
    if (!$candidatos) {
        $candidatos = fonte_google_books($isbn);
    }
    // Garante o ISBN pesquisado quando a fonte não devolve nenhum
    foreach ($candidatos as &$c) {
        if ($c['isbn'] === '') $c['isbn'] = $isbn;
    }
    unset($c);
} elseif (!empty($_GET['titulo']) || !empty($_GET['autor'])) {
    $titulo = trim($_GET['titulo'] ?? '');
    $autor  = trim($_GET['autor'] ?? '');
    $q = [];
    if ($titulo) $q[] = 'intitle:"' . $titulo . '"';
    if ($autor)  $q[] = 'inauthor:"' . $autor . '"';
    $candidatos = fonte_google_books(implode(' ', $q));
    if (count($candidatos) < 3 && $titulo) {
        // Repete sem aspas (mais tolerante a pequenas diferenças de grafia)
        $candidatos = array_merge($candidatos, fonte_google_books(trim("$titulo $autor")));
    }
    $candidatos = array_merge($candidatos, fonte_openlibrary_busca($titulo, $autor));
} else {
    responder(422, ['erro' => 'Informe isbn OU titulo/autor.']);
}

// ---------------------------------------------------------------- Deduplicação
// Prioriza registros mais completos; agrupa por ISBN (ou título+editora+ano)
usort($candidatos, function ($a, $b) {
    $nota = fn($c) => ($c['sinopse'] ? 2 : 0) + ($c['capa_url'] ? 2 : 0) + ($c['editora'] ? 1 : 0)
                    + ($c['paginas'] ? 1 : 0) + ($c['categorias'] ? 1 : 0) + ($c['isbn'] ? 1 : 0);
    return $nota($b) <=> $nota($a);
});
$unicos = [];
foreach ($candidatos as $c) {
    $chave = $c['isbn'] !== ''
        ? 'i' . isbn_limpar($c['isbn'])
        : 't' . mb_strtolower($c['titulo'] . '|' . $c['editora'] . '|' . $c['ano_publicacao']);
    if (!isset($unicos[$chave])) {
        $unicos[$chave] = $c;
    } else {
        // Completa campos vazios com dados de outra fonte
        foreach ($c as $campo => $valor) {
            if (empty($unicos[$chave][$campo]) && !empty($valor)) {
                $unicos[$chave][$campo] = $valor;
            }
        }
    }
}

responder(200, ['candidatos' => array_slice(array_values($unicos), 0, 10)]);
