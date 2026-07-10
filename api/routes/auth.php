<?php
/** Rotas: /api/auth/* — login, registro, perfil, troca de senha */

$acao = $segmentos[1] ?? '';

// POST /api/auth/login
if ($METODO === 'POST' && $acao === 'login') {
    $dados = entrada();
    $email = trim($dados['email'] ?? '');
    $senha = $dados['senha'] ?? '';
    if (!$email || !$senha) responder(422, ['erro' => 'Informe e-mail e senha.']);

    $stmt = db()->prepare("SELECT * FROM usuarios WHERE email = ?");
    $stmt->execute([$email]);
    $u = $stmt->fetch();

    if (!$u || !password_verify($senha, $u['senha_hash'])) {
        responder(401, ['erro' => 'E-mail ou senha incorretos.']);
    }
    if ($u['status'] !== 'ativo') {
        responder(403, ['erro' => 'Sua conta está ' . $u['status'] . '. Procure a equipe da biblioteca.']);
    }

    db()->prepare("UPDATE usuarios SET ultimo_acesso = NOW() WHERE id = ?")->execute([$u['id']]);
    unset($u['senha_hash']);
    responder(200, [
        'token'   => jwt_criar(['uid' => (int)$u['id'], 'papel' => $u['papel']]),
        'usuario' => $u,
    ]);
}

// POST /api/auth/registro — auto-cadastro de membros (papel sempre "usuario")
if ($METODO === 'POST' && $acao === 'registro') {
    $dados = entrada();
    $nome  = trim($dados['nome'] ?? '');
    $email = trim($dados['email'] ?? '');
    $senha = $dados['senha'] ?? '';

    if (mb_strlen($nome) < 3)                          responder(422, ['erro' => 'Informe seu nome completo.']);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL))    responder(422, ['erro' => 'E-mail inválido.']);
    if (strlen($senha) < 6)                            responder(422, ['erro' => 'A senha deve ter ao menos 6 caracteres.']);

    $stmt = db()->prepare("SELECT id FROM usuarios WHERE email = ?");
    $stmt->execute([$email]);
    if ($stmt->fetch()) responder(409, ['erro' => 'Este e-mail já está cadastrado.']);

    $stmt = db()->prepare("INSERT INTO usuarios (nome, email, senha_hash, telefone, whatsapp) VALUES (?,?,?,?,?)");
    $stmt->execute([
        $nome, $email,
        password_hash($senha, PASSWORD_BCRYPT),
        $dados['telefone'] ?? null,
        $dados['whatsapp'] ?? null,
    ]);
    $id = (int)db()->lastInsertId();
    auditar($id, 'registro', 'usuarios', $id, "Auto-cadastro: $nome");
    notificar($id, 'boas-vindas', '🍞 Bem-vindo(a) ao MANÁ!',
        'Belém significa "Casa do Pão". Aqui você encontra o alimento diário da Palavra. Boa leitura!');

    responder(201, [
        'token'   => jwt_criar(['uid' => $id, 'papel' => 'usuario']),
        'usuario' => ['id' => $id, 'nome' => $nome, 'email' => $email, 'papel' => 'usuario', 'status' => 'ativo'],
    ]);
}

// GET /api/auth/me
if ($METODO === 'GET' && $acao === 'me') {
    responder(200, ['usuario' => exigir_login()]);
}

// PUT /api/auth/perfil — atualiza dados próprios
if ($METODO === 'PUT' && $acao === 'perfil') {
    $u = exigir_login();
    $dados = entrada();
    $stmt = db()->prepare("UPDATE usuarios SET nome = ?, telefone = ?, whatsapp = ?, congregacao = ? WHERE id = ?");
    $stmt->execute([
        trim($dados['nome'] ?? $u['nome']),
        $dados['telefone'] ?? $u['telefone'],
        $dados['whatsapp'] ?? $u['whatsapp'],
        $dados['congregacao'] ?? $u['congregacao'],
        $u['id'],
    ]);
    responder(200, ['ok' => true]);
}

// POST /api/auth/foto — o próprio usuário envia/troca sua foto de rosto
if ($METODO === 'POST' && $acao === 'foto') {
    $u = exigir_login();
    $dados = entrada();
    $url = salvar_foto_usuario((int)$u['id'], $dados['imagem'] ?? '');
    auditar($u['id'], 'foto_atualizada', 'usuarios', $u['id']);
    responder(200, ['foto_url' => $url]);
}

// PUT /api/auth/senha
if ($METODO === 'PUT' && $acao === 'senha') {
    $u = exigir_login();
    $dados = entrada();
    $stmt = db()->prepare("SELECT senha_hash FROM usuarios WHERE id = ?");
    $stmt->execute([$u['id']]);
    $hash = $stmt->fetchColumn();

    if (!password_verify($dados['senha_atual'] ?? '', $hash)) {
        responder(401, ['erro' => 'Senha atual incorreta.']);
    }
    if (strlen($dados['nova_senha'] ?? '') < 6) {
        responder(422, ['erro' => 'A nova senha deve ter ao menos 6 caracteres.']);
    }
    db()->prepare("UPDATE usuarios SET senha_hash = ? WHERE id = ?")
        ->execute([password_hash($dados['nova_senha'], PASSWORD_BCRYPT), $u['id']]);
    auditar($u['id'], 'troca_senha', 'usuarios', $u['id']);
    responder(200, ['ok' => true]);
}
