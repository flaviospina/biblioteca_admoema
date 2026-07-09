<?php
/** Rotas: /api/notificacoes — central de avisos do usuário */

$acao = $segmentos[1] ?? null;

// GET /api/notificacoes
if ($METODO === 'GET') {
    $u = exigir_login();
    $stmt = db()->prepare(
        "SELECT * FROM notificacoes WHERE usuario_id = ? ORDER BY criado_em DESC LIMIT 50");
    $stmt->execute([$u['id']]);
    $naoLidas = db()->prepare("SELECT COUNT(*) FROM notificacoes WHERE usuario_id = ? AND lida = 0");
    $naoLidas->execute([$u['id']]);
    responder(200, ['notificacoes' => $stmt->fetchAll(), 'nao_lidas' => (int)$naoLidas->fetchColumn()]);
}

// POST /api/notificacoes/ler — marca todas como lidas
if ($METODO === 'POST' && $acao === 'ler') {
    $u = exigir_login();
    db()->prepare("UPDATE notificacoes SET lida = 1 WHERE usuario_id = ?")->execute([$u['id']]);
    responder(200, ['ok' => true]);
}
