<?php
/** Rotas: /api/usuarios — gestão de leitores e equipe (gerente/admin) */

$id = isset($segmentos[1]) ? (int)$segmentos[1] : null;

// GET /api/usuarios?busca=&papel= — bibliotecário+ (precisa localizar leitores no balcão)
if ($METODO === 'GET' && !$id) {
    exigir_papel('bibliotecario');
    $where  = [];
    $params = [];
    if (!empty($_GET['busca'])) {
        $where[] = '(nome LIKE ? OR email LIKE ?)';
        $b = '%' . $_GET['busca'] . '%';
        array_push($params, $b, $b);
    }
    if (!empty($_GET['papel'])) {
        $where[] = 'papel = ?';
        $params[] = $_GET['papel'];
    }
    $sqlWhere = $where ? 'WHERE ' . implode(' AND ', $where) : '';
    $stmt = db()->prepare(
        "SELECT id, nome, email, telefone, whatsapp, papel, congregacao, status, criado_em, ultimo_acesso,
           (SELECT COUNT(*) FROM emprestimos e WHERE e.usuario_id = usuarios.id AND e.status IN ('ativo','atrasado')) AS emprestimos_ativos,
           (SELECT COUNT(*) FROM emprestimos e WHERE e.usuario_id = usuarios.id AND e.status = 'atrasado') AS atrasos
         FROM usuarios $sqlWhere ORDER BY nome LIMIT 500");
    $stmt->execute($params);
    responder(200, ['usuarios' => $stmt->fetchAll()]);
}

// POST /api/usuarios — criar usuário com papel (gerente cria até bibliotecário; admin cria qualquer)
if ($METODO === 'POST' && !$id) {
    $u = exigir_papel('gerente');
    $dados = entrada();
    $papel = $dados['papel'] ?? 'usuario';

    if (!isset(NIVEIS[$papel])) responder(422, ['erro' => 'Papel inválido.']);
    if ($u['papel'] !== 'admin' && NIVEIS[$papel] >= NIVEIS['gerente']) {
        responder(403, ['erro' => 'Somente o administrador pode criar gerentes ou administradores.']);
    }
    if (!filter_var($dados['email'] ?? '', FILTER_VALIDATE_EMAIL)) responder(422, ['erro' => 'E-mail inválido.']);
    if (strlen($dados['senha'] ?? '') < 6) responder(422, ['erro' => 'Senha deve ter ao menos 6 caracteres.']);

    $stmt = db()->prepare("SELECT id FROM usuarios WHERE email = ?");
    $stmt->execute([$dados['email']]);
    if ($stmt->fetch()) responder(409, ['erro' => 'E-mail já cadastrado.']);

    $stmt = db()->prepare(
        "INSERT INTO usuarios (nome, email, senha_hash, telefone, whatsapp, papel, congregacao)
         VALUES (?,?,?,?,?,?,?)");
    $stmt->execute([
        trim($dados['nome'] ?? ''),
        trim($dados['email']),
        password_hash($dados['senha'], PASSWORD_BCRYPT),
        $dados['telefone'] ?? null,
        $dados['whatsapp'] ?? null,
        $papel,
        $dados['congregacao'] ?? 'Setor 124 - Moema',
    ]);
    $novoId = (int)db()->lastInsertId();
    auditar($u['id'], 'usuario_criado', 'usuarios', $novoId, "{$dados['nome']} ($papel)");
    responder(201, ['id' => $novoId]);
}

// PUT /api/usuarios/{id} — editar dados / papel / status
if ($METODO === 'PUT' && $id) {
    $u = exigir_papel('gerente');
    $dados = entrada();

    $stmt = db()->prepare("SELECT * FROM usuarios WHERE id = ?");
    $stmt->execute([$id]);
    $alvo = $stmt->fetch();
    if (!$alvo) responder(404, ['erro' => 'Usuário não encontrado.']);

    // Gerente não mexe em gerentes/admins; troca de papel para gerente+ é só do admin
    if ($u['papel'] !== 'admin' && NIVEIS[$alvo['papel']] >= NIVEIS['gerente']) {
        responder(403, ['erro' => 'Somente o administrador pode alterar este usuário.']);
    }
    $novoPapel = $dados['papel'] ?? $alvo['papel'];
    if (!isset(NIVEIS[$novoPapel])) responder(422, ['erro' => 'Papel inválido.']);
    if ($u['papel'] !== 'admin' && NIVEIS[$novoPapel] >= NIVEIS['gerente']) {
        responder(403, ['erro' => 'Somente o administrador pode conceder este papel.']);
    }
    // Protege o último admin do sistema
    if ($alvo['papel'] === 'admin' && ($novoPapel !== 'admin' || ($dados['status'] ?? 'ativo') !== 'ativo')) {
        $totalAdmins = (int)db()->query("SELECT COUNT(*) FROM usuarios WHERE papel='admin' AND status='ativo'")->fetchColumn();
        if ($totalAdmins <= 1) responder(409, ['erro' => 'Não é possível rebaixar ou bloquear o único administrador ativo.']);
    }

    $stmt = db()->prepare(
        "UPDATE usuarios SET nome=?, email=?, telefone=?, whatsapp=?, papel=?, congregacao=?, status=? WHERE id=?");
    $stmt->execute([
        trim($dados['nome'] ?? $alvo['nome']),
        trim($dados['email'] ?? $alvo['email']),
        $dados['telefone'] ?? $alvo['telefone'],
        $dados['whatsapp'] ?? $alvo['whatsapp'],
        $novoPapel,
        $dados['congregacao'] ?? $alvo['congregacao'],
        $dados['status'] ?? $alvo['status'],
        $id,
    ]);

    if (!empty($dados['nova_senha'])) {
        if (strlen($dados['nova_senha']) < 6) responder(422, ['erro' => 'Senha deve ter ao menos 6 caracteres.']);
        db()->prepare("UPDATE usuarios SET senha_hash = ? WHERE id = ?")
            ->execute([password_hash($dados['nova_senha'], PASSWORD_BCRYPT), $id]);
    }

    auditar($u['id'], 'usuario_editado', 'usuarios', $id, "Papel: $novoPapel, Status: " . ($dados['status'] ?? $alvo['status']));
    responder(200, ['ok' => true]);
}

// DELETE /api/usuarios/{id} — somente admin
if ($METODO === 'DELETE' && $id) {
    $u = exigir_papel('admin');
    if ($id === (int)$u['id']) responder(409, ['erro' => 'Você não pode excluir a própria conta.']);

    $stmt = db()->prepare("SELECT COUNT(*) FROM emprestimos WHERE usuario_id = ? AND status IN ('ativo','atrasado')");
    $stmt->execute([$id]);
    if ((int)$stmt->fetchColumn() > 0) {
        responder(409, ['erro' => 'Usuário possui empréstimos ativos. Regularize antes de excluir.']);
    }
    db()->prepare("UPDATE usuarios SET status = 'inativo' WHERE id = ?")->execute([$id]);
    auditar($u['id'], 'usuario_inativado', 'usuarios', $id);
    responder(200, ['ok' => true, 'mensagem' => 'Usuário inativado (histórico preservado).']);
}
