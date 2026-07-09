<?php
/** Rotas: /api/reservas — fila de espera dos livros */

$id = isset($segmentos[1]) ? (int)$segmentos[1] : null;

// GET /api/reservas — equipe vê todas; membro vê as próprias
if ($METODO === 'GET' && !$id) {
    $u = exigir_login();
    atualizar_atrasados();

    $where  = '';
    $params = [];
    if (NIVEIS[$u['papel']] < NIVEIS['bibliotecario']) {
        $where = 'WHERE r.usuario_id = ?';
        $params[] = $u['id'];
    } elseif (!empty($_GET['status'])) {
        $where = 'WHERE r.status = ?';
        $params[] = $_GET['status'];
    }

    $stmt = db()->prepare(
        "SELECT r.*, l.titulo, l.autor, l.capa_url, u2.nome AS usuario_nome, u2.whatsapp AS usuario_whatsapp,
           (SELECT COUNT(*) + 1 FROM reservas r2
             WHERE r2.livro_id = r.livro_id AND r2.status = 'ativa' AND r2.data_reserva < r.data_reserva) AS posicao_fila
         FROM reservas r
         JOIN livros l   ON l.id = r.livro_id
         JOIN usuarios u2 ON u2.id = r.usuario_id
         $where
         ORDER BY FIELD(r.status,'disponivel','ativa','atendida','expirada','cancelada'), r.data_reserva
         LIMIT 300");
    $stmt->execute($params);
    responder(200, ['reservas' => $stmt->fetchAll()]);
}

// POST /api/reservas {livro_id} — membro entra na fila
if ($METODO === 'POST' && !$id) {
    $u = exigir_login();
    atualizar_atrasados();
    $dados = entrada();
    $livroId = (int)($dados['livro_id'] ?? 0);

    $stmt = db()->prepare("SELECT titulo FROM livros WHERE id = ?");
    $stmt->execute([$livroId]);
    $titulo = $stmt->fetchColumn();
    if (!$titulo) responder(404, ['erro' => 'Livro não encontrado.']);

    $stmt = db()->prepare("SELECT 1 FROM reservas WHERE livro_id = ? AND usuario_id = ? AND status IN ('ativa','disponivel')");
    $stmt->execute([$livroId, $u['id']]);
    if ($stmt->fetch()) responder(409, ['erro' => 'Você já possui uma reserva ativa deste livro.']);

    $stmt = db()->prepare(
        "SELECT 1 FROM emprestimos e JOIN exemplares x ON x.id = e.exemplar_id
         WHERE x.livro_id = ? AND e.usuario_id = ? AND e.status IN ('ativo','atrasado')");
    $stmt->execute([$livroId, $u['id']]);
    if ($stmt->fetch()) responder(409, ['erro' => 'Você já está com um exemplar deste livro emprestado.']);

    db()->prepare("INSERT INTO reservas (livro_id, usuario_id) VALUES (?,?)")->execute([$livroId, $u['id']]);
    $reservaId = (int)db()->lastInsertId();

    $stmt = db()->prepare("SELECT COUNT(*) FROM reservas WHERE livro_id = ? AND status = 'ativa'");
    $stmt->execute([$livroId]);
    $posicao = (int)$stmt->fetchColumn();

    auditar($u['id'], 'reserva_criada', 'reservas', $reservaId, $titulo);
    responder(201, ['id' => $reservaId, 'posicao_fila' => $posicao,
        'mensagem' => $posicao <= 1
            ? 'Reserva registrada! Você é o próximo da fila.'
            : "Reserva registrada! Você é o {$posicao}º da fila."]);
}

// DELETE /api/reservas/{id} — cancelar (o próprio membro ou a equipe)
if ($METODO === 'DELETE' && $id) {
    $u = exigir_login();
    $stmt = db()->prepare("SELECT * FROM reservas WHERE id = ?");
    $stmt->execute([$id]);
    $r = $stmt->fetch();
    if (!$r) responder(404, ['erro' => 'Reserva não encontrada.']);
    if (NIVEIS[$u['papel']] < NIVEIS['bibliotecario'] && (int)$r['usuario_id'] !== (int)$u['id']) {
        responder(403, ['erro' => 'Você só pode cancelar suas próprias reservas.']);
    }

    db()->prepare("UPDATE reservas SET status = 'cancelada' WHERE id = ?")->execute([$id]);

    // Se o exemplar estava separado para esta reserva, libera ou repassa ao próximo da fila
    if ($r['status'] === 'disponivel') {
        $stmt = db()->prepare(
            "SELECT id FROM exemplares WHERE livro_id = ? AND status = 'reservado' LIMIT 1");
        $stmt->execute([$r['livro_id']]);
        $exemplarId = $stmt->fetchColumn();
        if ($exemplarId) {
            $stmt = db()->prepare(
                "SELECT id, usuario_id FROM reservas WHERE livro_id = ? AND status = 'ativa'
                 ORDER BY data_reserva ASC LIMIT 1");
            $stmt->execute([$r['livro_id']]);
            $proxima = $stmt->fetch();
            if ($proxima) {
                $expira = date('Y-m-d', strtotime('+' . config_sistema('dias_reserva_expira', '3') . ' days'));
                db()->prepare("UPDATE reservas SET status = 'disponivel', data_expiracao = ? WHERE id = ?")
                    ->execute([$expira, $proxima['id']]);
                notificar((int)$proxima['usuario_id'], 'reserva_disponivel',
                    '🔔 Sua reserva está disponível!', 'Retire o livro na biblioteca.');
            } else {
                db()->prepare("UPDATE exemplares SET status = 'disponivel' WHERE id = ?")->execute([$exemplarId]);
            }
        }
    }

    auditar($u['id'], 'reserva_cancelada', 'reservas', $id);
    responder(200, ['ok' => true]);
}
