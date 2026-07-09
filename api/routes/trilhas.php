<?php
/** Rotas: /api/trilhas — DIFERENCIAL: Trilhas de Leitura (jornadas de discipulado) */

$id   = isset($segmentos[1]) && is_numeric($segmentos[1]) ? (int)$segmentos[1] : null;
$acao = $segmentos[2] ?? null;

/** Livros já lidos (devolvidos) pelo usuário. */
function livros_lidos(int $usuarioId): array
{
    $stmt = db()->prepare(
        "SELECT DISTINCT x.livro_id FROM emprestimos e
         JOIN exemplares x ON x.id = e.exemplar_id
         WHERE e.usuario_id = ? AND e.status = 'devolvido'");
    $stmt->execute([$usuarioId]);
    return array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
}

// GET /api/trilhas — lista com progresso do usuário logado
if ($METODO === 'GET' && !$id) {
    $u = exigir_login();
    $incluirInativas = NIVEIS[$u['papel']] >= NIVEIS['gerente'] && !empty($_GET['todas']);

    $sql = "SELECT t.*,
              (SELECT COUNT(*) FROM trilha_livros tl WHERE tl.trilha_id = t.id) AS total_livros,
              (SELECT COUNT(*) FROM trilha_inscricoes ti WHERE ti.trilha_id = t.id) AS total_inscritos,
              (SELECT COUNT(*) FROM trilha_inscricoes ti WHERE ti.trilha_id = t.id AND ti.data_conclusao IS NOT NULL) AS total_concluintes
            FROM trilhas t " . ($incluirInativas ? '' : 'WHERE t.ativa = 1 ') . "ORDER BY t.criado_em DESC";
    $trilhas = db()->query($sql)->fetchAll();

    $lidos = livros_lidos((int)$u['id']);
    foreach ($trilhas as &$t) {
        $stmt = db()->prepare("SELECT livro_id FROM trilha_livros WHERE trilha_id = ?");
        $stmt->execute([$t['id']]);
        $livrosTrilha = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
        $t['livros_lidos'] = count(array_intersect($livrosTrilha, $lidos));

        $stmt = db()->prepare("SELECT data_inscricao, data_conclusao FROM trilha_inscricoes WHERE trilha_id = ? AND usuario_id = ?");
        $stmt->execute([$t['id'], $u['id']]);
        $t['minha_inscricao'] = $stmt->fetch() ?: null;
    }
    responder(200, ['trilhas' => $trilhas]);
}

// GET /api/trilhas/{id} — detalhe com livros ordenados e progresso
if ($METODO === 'GET' && $id) {
    $u = exigir_login();
    $stmt = db()->prepare("SELECT * FROM trilhas WHERE id = ?");
    $stmt->execute([$id]);
    $trilha = $stmt->fetch();
    if (!$trilha) responder(404, ['erro' => 'Trilha não encontrada.']);

    $lidos = livros_lidos((int)$u['id']);
    $stmt = db()->prepare(
        "SELECT tl.ordem, l.id, l.titulo, l.autor, l.capa_url, l.sinopse,
           (SELECT COUNT(*) FROM exemplares e WHERE e.livro_id = l.id AND e.status = 'disponivel') AS disponiveis
         FROM trilha_livros tl JOIN livros l ON l.id = tl.livro_id
         WHERE tl.trilha_id = ? ORDER BY tl.ordem, l.titulo");
    $stmt->execute([$id]);
    $livros = $stmt->fetchAll();
    foreach ($livros as &$l) {
        $l['lido'] = in_array((int)$l['id'], $lidos, true);
    }
    $trilha['livros'] = $livros;

    $stmt = db()->prepare("SELECT data_inscricao, data_conclusao FROM trilha_inscricoes WHERE trilha_id = ? AND usuario_id = ?");
    $stmt->execute([$id, $u['id']]);
    $trilha['minha_inscricao'] = $stmt->fetch() ?: null;

    responder(200, ['trilha' => $trilha]);
}

// POST /api/trilhas — criar trilha (gerente+)
if ($METODO === 'POST' && !$id) {
    $u = exigir_papel('gerente');
    $dados = entrada();
    if (empty($dados['nome'])) responder(422, ['erro' => 'Informe o nome da trilha.']);
    $stmt = db()->prepare("INSERT INTO trilhas (nome, descricao, icone, cor, criado_por) VALUES (?,?,?,?,?)");
    $stmt->execute([
        trim($dados['nome']),
        $dados['descricao'] ?? null,
        $dados['icone'] ?? '📖',
        $dados['cor'] ?? '#1e3a5f',
        $u['id'],
    ]);
    $trilhaId = (int)db()->lastInsertId();
    foreach ($dados['livros'] ?? [] as $i => $livroId) {
        db()->prepare("INSERT IGNORE INTO trilha_livros (trilha_id, livro_id, ordem) VALUES (?,?,?)")
            ->execute([$trilhaId, (int)$livroId, $i + 1]);
    }
    auditar($u['id'], 'trilha_criada', 'trilhas', $trilhaId, $dados['nome']);
    responder(201, ['id' => $trilhaId]);
}

// PUT /api/trilhas/{id} — editar trilha e sua lista de livros
if ($METODO === 'PUT' && $id && !$acao) {
    $u = exigir_papel('gerente');
    $dados = entrada();
    $stmt = db()->prepare("UPDATE trilhas SET nome=?, descricao=?, icone=?, cor=?, ativa=? WHERE id=?");
    $stmt->execute([
        trim($dados['nome'] ?? ''),
        $dados['descricao'] ?? null,
        $dados['icone'] ?? '📖',
        $dados['cor'] ?? '#1e3a5f',
        isset($dados['ativa']) ? (int)!!$dados['ativa'] : 1,
        $id,
    ]);
    if (isset($dados['livros']) && is_array($dados['livros'])) {
        db()->prepare("DELETE FROM trilha_livros WHERE trilha_id = ?")->execute([$id]);
        foreach ($dados['livros'] as $i => $livroId) {
            db()->prepare("INSERT IGNORE INTO trilha_livros (trilha_id, livro_id, ordem) VALUES (?,?,?)")
                ->execute([$id, (int)$livroId, $i + 1]);
        }
    }
    auditar($u['id'], 'trilha_editada', 'trilhas', $id, $dados['nome'] ?? null);
    responder(200, ['ok' => true]);
}

// POST /api/trilhas/{id}/inscrever — membro entra na jornada
if ($METODO === 'POST' && $id && $acao === 'inscrever') {
    $u = exigir_login();
    $stmt = db()->prepare("SELECT nome FROM trilhas WHERE id = ? AND ativa = 1");
    $stmt->execute([$id]);
    $nome = $stmt->fetchColumn();
    if (!$nome) responder(404, ['erro' => 'Trilha não encontrada ou inativa.']);

    $stmt = db()->prepare("INSERT IGNORE INTO trilha_inscricoes (trilha_id, usuario_id) VALUES (?,?)");
    $stmt->execute([$id, $u['id']]);
    if ($stmt->rowCount() === 0) responder(409, ['erro' => 'Você já está inscrito nesta trilha.']);

    notificar((int)$u['id'], 'trilha', "🛤️ Jornada iniciada: $nome",
        'Leia os livros da trilha e conclua sua jornada de discipulado!');
    responder(201, ['ok' => true]);
}

// DELETE /api/trilhas/{id} — desativar (gerente+)
if ($METODO === 'DELETE' && $id) {
    $u = exigir_papel('gerente');
    db()->prepare("UPDATE trilhas SET ativa = 0 WHERE id = ?")->execute([$id]);
    auditar($u['id'], 'trilha_desativada', 'trilhas', $id);
    responder(200, ['ok' => true]);
}
