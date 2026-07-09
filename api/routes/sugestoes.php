<?php
/** Rotas: /api/sugestoes — membros sugerem novos títulos para o acervo */

$id = isset($segmentos[1]) ? (int)$segmentos[1] : null;

// GET — equipe vê todas; membro vê as próprias
if ($METODO === 'GET' && !$id) {
    $u = exigir_login();
    $where = '';
    $params = [];
    if (NIVEIS[$u['papel']] < NIVEIS['bibliotecario']) {
        $where = 'WHERE s.usuario_id = ?';
        $params[] = $u['id'];
    }
    $stmt = db()->prepare(
        "SELECT s.*, u.nome AS usuario_nome FROM sugestoes s
         JOIN usuarios u ON u.id = s.usuario_id
         $where ORDER BY FIELD(s.status,'pendente','aprovada','adquirida','recusada'), s.criado_em DESC LIMIT 200");
    $stmt->execute($params);
    responder(200, ['sugestoes' => $stmt->fetchAll()]);
}

// POST — membro cria sugestão
if ($METODO === 'POST' && !$id) {
    $u = exigir_login();
    $dados = entrada();
    if (empty($dados['titulo'])) responder(422, ['erro' => 'Informe o título do livro.']);
    $stmt = db()->prepare("INSERT INTO sugestoes (usuario_id, titulo, autor, motivo) VALUES (?,?,?,?)");
    $stmt->execute([$u['id'], trim($dados['titulo']), $dados['autor'] ?? null, $dados['motivo'] ?? null]);
    responder(201, ['id' => (int)db()->lastInsertId()]);
}

// PUT /api/sugestoes/{id} — gerente+ atualiza status
if ($METODO === 'PUT' && $id) {
    $u = exigir_papel('gerente');
    $dados = entrada();
    $status = $dados['status'] ?? '';
    if (!in_array($status, ['pendente', 'aprovada', 'recusada', 'adquirida'], true)) {
        responder(422, ['erro' => 'Status inválido.']);
    }
    $stmt = db()->prepare("SELECT usuario_id, titulo FROM sugestoes WHERE id = ?");
    $stmt->execute([$id]);
    $s = $stmt->fetch();
    if (!$s) responder(404, ['erro' => 'Sugestão não encontrada.']);

    db()->prepare("UPDATE sugestoes SET status = ? WHERE id = ?")->execute([$status, $id]);
    if (in_array($status, ['aprovada', 'adquirida'], true)) {
        $msg = $status === 'adquirida'
            ? "O livro \"{$s['titulo']}\" que você sugeriu chegou ao acervo!"
            : "Sua sugestão \"{$s['titulo']}\" foi aprovada e entrará na lista de aquisições.";
        notificar((int)$s['usuario_id'], 'sugestao', '💡 Sua sugestão avançou!', $msg);
    }
    auditar($u['id'], 'sugestao_atualizada', 'sugestoes', $id, "$status: {$s['titulo']}");
    responder(200, ['ok' => true]);
}
