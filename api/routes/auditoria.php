<?php
/** Rota: GET /api/auditoria — trilha de ações (gerente/admin) */

if ($METODO !== 'GET') responder(405, ['erro' => 'Método não permitido.']);
exigir_papel('gerente');

$where  = [];
$params = [];
if (!empty($_GET['entidade'])) {
    $where[]  = 'a.entidade = ?';
    $params[] = $_GET['entidade'];
}
if (!empty($_GET['busca'])) {
    $where[]  = '(a.detalhes LIKE ? OR u.nome LIKE ? OR a.acao LIKE ?)';
    $b = '%' . $_GET['busca'] . '%';
    array_push($params, $b, $b, $b);
}
$sqlWhere = $where ? 'WHERE ' . implode(' AND ', $where) : '';

$stmt = db()->prepare(
    "SELECT a.*, u.nome AS usuario_nome FROM auditoria a
     LEFT JOIN usuarios u ON u.id = a.usuario_id
     $sqlWhere ORDER BY a.criado_em DESC LIMIT 300");
$stmt->execute($params);
responder(200, ['auditoria' => $stmt->fetchAll()]);
