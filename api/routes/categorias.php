<?php
/** Rotas: /api/categorias */

if ($METODO === 'GET') {
    exigir_login();
    $categorias = db()->query(
        "SELECT c.*, (SELECT COUNT(*) FROM livros l WHERE l.categoria_id = c.id) AS total_livros
         FROM categorias c ORDER BY c.nome")->fetchAll();
    responder(200, ['categorias' => $categorias]);
}

if ($METODO === 'POST') {
    $u = exigir_papel('gerente');
    $dados = entrada();
    if (empty($dados['nome'])) responder(422, ['erro' => 'Informe o nome da categoria.']);
    $stmt = db()->prepare("INSERT INTO categorias (nome, cor) VALUES (?,?)");
    $stmt->execute([trim($dados['nome']), $dados['cor'] ?? '#1e3a5f']);
    auditar($u['id'], 'categoria_criada', 'categorias', (int)db()->lastInsertId(), $dados['nome']);
    responder(201, ['id' => (int)db()->lastInsertId()]);
}

$id = isset($segmentos[1]) ? (int)$segmentos[1] : null;

if ($METODO === 'DELETE' && $id) {
    $u = exigir_papel('gerente');
    db()->prepare("DELETE FROM categorias WHERE id = ?")->execute([$id]);
    auditar($u['id'], 'categoria_excluida', 'categorias', $id);
    responder(200, ['ok' => true]);
}
