<?php
/**
 * MANÁ — Biblioteca Digital | Roteador da API
 * Todas as requisições /api/* passam por aqui (ver .htaccess).
 */

require __DIR__ . '/src/helpers.php';

// ---------------------------------------------------------------- CORS
$origem = $_SERVER['HTTP_ORIGIN'] ?? '';
$permitidas = config()['cors_origens'] ?? [];
if ($origem && in_array($origem, $permitidas, true)) {
    header("Access-Control-Allow-Origin: $origem");
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
}
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ---------------------------------------------------------------- Rota
// Aceita tanto /api/index.php?rota=livros/1 quanto /api/livros/1 (rewrite)
$rota = $_GET['rota'] ?? '';
if ($rota === '') {
    $uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $pos = strpos($uri, '/api/');
    $rota = $pos !== false ? substr($uri, $pos + 5) : '';
}
$segmentos = array_values(array_filter(explode('/', trim($rota, '/'))));
$recurso = $segmentos[0] ?? '';
$METODO  = $_SERVER['REQUEST_METHOD'];

$recursosValidos = [
    'auth', 'livros', 'categorias', 'exemplares', 'emprestimos', 'reservas',
    'usuarios', 'dashboard', 'trilhas', 'avaliacoes', 'sugestoes',
    'notificacoes', 'configuracoes', 'auditoria', 'minha-estante',
];

if (!in_array($recurso, $recursosValidos, true)) {
    responder(404, ['erro' => "Recurso desconhecido: '$recurso'"]);
}

try {
    require __DIR__ . '/routes/' . str_replace('-', '_', $recurso) . '.php';
} catch (PDOException $e) {
    responder(500, ['erro' => 'Erro de banco de dados.', 'detalhe' => $e->getMessage()]);
} catch (Throwable $e) {
    responder(500, ['erro' => 'Erro interno.', 'detalhe' => $e->getMessage()]);
}

responder(404, ['erro' => 'Rota não encontrada.']);
