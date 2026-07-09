<?php
/** Rotas: /api/exemplares — cópias físicas */

$id = isset($segmentos[1]) ? (int)$segmentos[1] : null;

// POST /api/exemplares — adiciona exemplar avulso a um livro existente
if ($METODO === 'POST' && !$id) {
    $u = exigir_papel('bibliotecario');
    $dados = entrada();
    $livroId = (int)($dados['livro_id'] ?? 0);
    if (!$livroId) responder(422, ['erro' => 'Informe o livro.']);

    $codigo = trim($dados['codigo'] ?? '');
    if ($codigo === '') {
        $stmt = db()->prepare("SELECT COUNT(*) FROM exemplares WHERE livro_id = ?");
        $stmt->execute([$livroId]);
        $codigo = sprintf('MN-%05d-%02d', $livroId, $stmt->fetchColumn() + 1);
    }

    $stmt = db()->prepare(
        "INSERT INTO exemplares (livro_id, codigo, estado_conservacao, origem, doador, data_aquisicao, observacao)
         VALUES (?,?,?,?,?,?,?)");
    $stmt->execute([
        $livroId, $codigo,
        $dados['estado_conservacao'] ?? 'bom',
        $dados['origem'] ?? 'doacao',
        $dados['doador'] ?? null,
        $dados['data_aquisicao'] ?? date('Y-m-d'),
        $dados['observacao'] ?? null,
    ]);
    auditar($u['id'], 'exemplar_criado', 'exemplares', (int)db()->lastInsertId(), $codigo);
    responder(201, ['id' => (int)db()->lastInsertId(), 'codigo' => $codigo]);
}

// PUT /api/exemplares/{id} — muda estado/status (manutenção, perdido…)
if ($METODO === 'PUT' && $id) {
    $u = exigir_papel('bibliotecario');
    $dados = entrada();
    $statusPermitidos = ['disponivel', 'manutencao', 'perdido'];
    $campos = [];
    $params = [];
    if (isset($dados['status']) && in_array($dados['status'], $statusPermitidos, true)) {
        $campos[] = 'status = ?';
        $params[] = $dados['status'];
    }
    if (isset($dados['estado_conservacao'])) {
        $campos[] = 'estado_conservacao = ?';
        $params[] = $dados['estado_conservacao'];
    }
    if (isset($dados['observacao'])) {
        $campos[] = 'observacao = ?';
        $params[] = $dados['observacao'];
    }
    if (!$campos) responder(422, ['erro' => 'Nada para atualizar.']);
    $params[] = $id;
    db()->prepare("UPDATE exemplares SET " . implode(', ', $campos) . " WHERE id = ? AND status <> 'emprestado'")
        ->execute($params);
    auditar($u['id'], 'exemplar_editado', 'exemplares', $id, json_encode($dados, JSON_UNESCAPED_UNICODE));
    responder(200, ['ok' => true]);
}

// DELETE /api/exemplares/{id}
if ($METODO === 'DELETE' && $id) {
    $u = exigir_papel('gerente');
    $stmt = db()->prepare("SELECT status FROM exemplares WHERE id = ?");
    $stmt->execute([$id]);
    if ($stmt->fetchColumn() === 'emprestado') {
        responder(409, ['erro' => 'Este exemplar está emprestado e não pode ser excluído.']);
    }
    db()->prepare("DELETE FROM exemplares WHERE id = ?")->execute([$id]);
    auditar($u['id'], 'exemplar_excluido', 'exemplares', $id);
    responder(200, ['ok' => true]);
}
