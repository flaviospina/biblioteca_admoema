<?php
/** Rotas: /api/avaliacoes — notas e comentários dos leitores */

$id = isset($segmentos[1]) ? (int)$segmentos[1] : null;

// POST /api/avaliacoes {livro_id, nota, comentario} — cria ou atualiza a própria avaliação
if ($METODO === 'POST' && !$id) {
    $u = exigir_login();
    $dados = entrada();
    $livroId = (int)($dados['livro_id'] ?? 0);
    $nota    = (int)($dados['nota'] ?? 0);
    if (!$livroId || $nota < 1 || $nota > 5) responder(422, ['erro' => 'Informe o livro e uma nota de 1 a 5.']);

    $stmt = db()->prepare(
        "INSERT INTO avaliacoes (livro_id, usuario_id, nota, comentario) VALUES (?,?,?,?)
         ON DUPLICATE KEY UPDATE nota = VALUES(nota), comentario = VALUES(comentario), criado_em = NOW()");
    $stmt->execute([$livroId, $u['id'], $nota, trim($dados['comentario'] ?? '') ?: null]);

    conceder_conquista((int)$u['id'], 'primeira_avaliacao');
    responder(201, ['ok' => true]);
}

// DELETE /api/avaliacoes/{id} — o próprio autor ou a equipe (moderação)
if ($METODO === 'DELETE' && $id) {
    $u = exigir_login();
    $stmt = db()->prepare("SELECT usuario_id FROM avaliacoes WHERE id = ?");
    $stmt->execute([$id]);
    $autor = $stmt->fetchColumn();
    if (!$autor) responder(404, ['erro' => 'Avaliação não encontrada.']);
    if ((int)$autor !== (int)$u['id'] && NIVEIS[$u['papel']] < NIVEIS['bibliotecario']) {
        responder(403, ['erro' => 'Sem permissão.']);
    }
    db()->prepare("DELETE FROM avaliacoes WHERE id = ?")->execute([$id]);
    responder(200, ['ok' => true]);
}
