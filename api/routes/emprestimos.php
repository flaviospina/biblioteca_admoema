<?php
/** Rotas: /api/emprestimos — circulação dos livros físicos */

$id   = isset($segmentos[1]) && is_numeric($segmentos[1]) ? (int)$segmentos[1] : null;
$acao = $segmentos[2] ?? null;

// GET /api/emprestimos?status=&busca= — equipe vê tudo; membro vê os próprios
if ($METODO === 'GET' && !$id) {
    $u = exigir_login();
    atualizar_atrasados();

    $where  = [];
    $params = [];
    if (NIVEIS[$u['papel']] < NIVEIS['bibliotecario']) {
        $where[]  = 'e.usuario_id = ?';
        $params[] = $u['id'];
    } elseif (!empty($_GET['usuario_id'])) {
        $where[]  = 'e.usuario_id = ?';
        $params[] = (int)$_GET['usuario_id'];
    }
    if (!empty($_GET['status'])) {
        $where[]  = 'e.status = ?';
        $params[] = $_GET['status'];
    }
    if (!empty($_GET['busca'])) {
        $where[]  = '(l.titulo LIKE ? OR u2.nome LIKE ? OR x.codigo LIKE ?)';
        $b = '%' . $_GET['busca'] . '%';
        array_push($params, $b, $b, $b);
    }
    $sqlWhere = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $stmt = db()->prepare(
        "SELECT e.*, x.codigo AS exemplar_codigo, l.id AS livro_id, l.titulo, l.autor, l.capa_url,
                u2.nome AS usuario_nome, u2.whatsapp AS usuario_whatsapp, b.nome AS bibliotecario_nome,
                DATEDIFF(CURDATE(), e.data_prevista) AS dias_atraso
         FROM emprestimos e
         JOIN exemplares x ON x.id = e.exemplar_id
         JOIN livros l     ON l.id = x.livro_id
         JOIN usuarios u2  ON u2.id = e.usuario_id
         LEFT JOIN usuarios b ON b.id = e.bibliotecario_id
         $sqlWhere
         ORDER BY FIELD(e.status,'atrasado','ativo','devolvido'), e.data_prevista ASC
         LIMIT 300");
    $stmt->execute($params);
    responder(200, ['emprestimos' => $stmt->fetchAll()]);
}

// POST /api/emprestimos — registrar novo empréstimo (equipe)
if ($METODO === 'POST' && !$id) {
    $u = exigir_papel('bibliotecario');
    atualizar_atrasados();
    $dados = entrada();
    $usuarioId = (int)($dados['usuario_id'] ?? 0);

    // Localiza o exemplar por id ou pelo código de tombo (etiqueta)
    if (!empty($dados['exemplar_codigo'])) {
        $stmt = db()->prepare("SELECT * FROM exemplares WHERE codigo = ?");
        $stmt->execute([trim($dados['exemplar_codigo'])]);
    } else {
        $stmt = db()->prepare("SELECT * FROM exemplares WHERE id = ?");
        $stmt->execute([(int)($dados['exemplar_id'] ?? 0)]);
    }
    $exemplar = $stmt->fetch();
    if (!$exemplar)  responder(404, ['erro' => 'Exemplar não encontrado.']);
    if (!$usuarioId) responder(422, ['erro' => 'Informe o leitor.']);

    if (!in_array($exemplar['status'], ['disponivel', 'reservado'], true)) {
        responder(409, ['erro' => "Este exemplar está '{$exemplar['status']}' e não pode ser emprestado."]);
    }

    // Regras de circulação
    $stmt = db()->prepare("SELECT COUNT(*) FROM emprestimos WHERE usuario_id = ? AND status IN ('ativo','atrasado')");
    $stmt->execute([$usuarioId]);
    $ativos = (int)$stmt->fetchColumn();
    $maximo = (int)config_sistema('max_emprestimos_ativos', '3');
    if ($ativos >= $maximo) {
        responder(409, ['erro' => "Este leitor já atingiu o limite de $maximo empréstimos simultâneos."]);
    }

    if (config_sistema('bloqueio_por_atraso', '1') === '1') {
        $stmt = db()->prepare("SELECT COUNT(*) FROM emprestimos WHERE usuario_id = ? AND status = 'atrasado'");
        $stmt->execute([$usuarioId]);
        if ((int)$stmt->fetchColumn() > 0) {
            responder(409, ['erro' => 'Este leitor possui devolução em atraso. Regularize antes de um novo empréstimo.']);
        }
    }

    // Se o livro tem fila de reserva, o primeiro da fila tem prioridade
    $stmt = db()->prepare(
        "SELECT id, usuario_id FROM reservas
         WHERE livro_id = ? AND status IN ('ativa','disponivel')
         ORDER BY data_reserva ASC LIMIT 1");
    $stmt->execute([$exemplar['livro_id']]);
    $primeiraReserva = $stmt->fetch();
    if ($primeiraReserva && (int)$primeiraReserva['usuario_id'] !== $usuarioId && $exemplar['status'] === 'reservado') {
        responder(409, ['erro' => 'Este exemplar está reservado para outro leitor da fila.']);
    }

    $prazo = (int)config_sistema('prazo_emprestimo_dias', '14');
    $dataPrevista = date('Y-m-d', strtotime("+$prazo days"));

    $db = db();
    $db->beginTransaction();
    try {
        $stmt = $db->prepare(
            "INSERT INTO emprestimos (exemplar_id, usuario_id, bibliotecario_id, data_prevista, observacao)
             VALUES (?,?,?,?,?)");
        $stmt->execute([$exemplar['id'], $usuarioId, $u['id'], $dataPrevista, $dados['observacao'] ?? null]);
        $emprestimoId = (int)$db->lastInsertId();

        $db->prepare("UPDATE exemplares SET status = 'emprestado' WHERE id = ?")->execute([$exemplar['id']]);

        // Atende a reserva do próprio leitor, se houver
        $stmt = $db->prepare(
            "UPDATE reservas SET status = 'atendida'
             WHERE livro_id = ? AND usuario_id = ? AND status IN ('ativa','disponivel')");
        $stmt->execute([$exemplar['livro_id'], $usuarioId]);

        $db->commit();
    } catch (Throwable $e) {
        $db->rollBack();
        throw $e;
    }

    $stmt = db()->prepare("SELECT titulo FROM livros WHERE id = ?");
    $stmt->execute([$exemplar['livro_id']]);
    $titulo = $stmt->fetchColumn();

    notificar($usuarioId, 'emprestimo', "📖 Empréstimo registrado: $titulo",
        "Devolução até " . date('d/m/Y', strtotime($dataPrevista)) . ". Boa leitura!");
    auditar($u['id'], 'emprestimo_criado', 'emprestimos', $emprestimoId,
        "Exemplar {$exemplar['codigo']} para usuário #$usuarioId até $dataPrevista");

    responder(201, ['id' => $emprestimoId, 'data_prevista' => $dataPrevista]);
}

// POST /api/emprestimos/{id}/devolver
if ($METODO === 'POST' && $id && $acao === 'devolver') {
    $u = exigir_papel('bibliotecario');

    $stmt = db()->prepare(
        "SELECT e.*, x.livro_id, x.codigo FROM emprestimos e
         JOIN exemplares x ON x.id = e.exemplar_id WHERE e.id = ?");
    $stmt->execute([$id]);
    $emp = $stmt->fetch();
    if (!$emp) responder(404, ['erro' => 'Empréstimo não encontrado.']);
    if ($emp['status'] === 'devolvido') responder(409, ['erro' => 'Este empréstimo já foi devolvido.']);

    $db = db();
    $db->beginTransaction();
    try {
        $db->prepare("UPDATE emprestimos SET status = 'devolvido', data_devolucao = NOW() WHERE id = ?")
           ->execute([$id]);

        // Se há fila de reserva, o exemplar fica separado para o próximo leitor
        $stmt = $db->prepare(
            "SELECT id, usuario_id FROM reservas
             WHERE livro_id = ? AND status = 'ativa' ORDER BY data_reserva ASC LIMIT 1");
        $stmt->execute([$emp['livro_id']]);
        $reserva = $stmt->fetch();

        if ($reserva) {
            $diasRetirada = (int)config_sistema('dias_reserva_expira', '3');
            $expira = date('Y-m-d', strtotime("+$diasRetirada days"));
            $db->prepare("UPDATE reservas SET status = 'disponivel', data_expiracao = ? WHERE id = ?")
               ->execute([$expira, $reserva['id']]);
            $db->prepare("UPDATE exemplares SET status = 'reservado' WHERE id = ?")
               ->execute([$emp['exemplar_id']]);
        } else {
            $db->prepare("UPDATE exemplares SET status = 'disponivel' WHERE id = ?")
               ->execute([$emp['exemplar_id']]);
        }
        $db->commit();
    } catch (Throwable $e) {
        $db->rollBack();
        throw $e;
    }

    $stmt = db()->prepare("SELECT titulo FROM livros WHERE id = ?");
    $stmt->execute([$emp['livro_id']]);
    $titulo = $stmt->fetchColumn();

    if (!empty($reserva)) {
        notificar((int)$reserva['usuario_id'], 'reserva_disponivel',
            "🔔 Sua reserva está disponível: $titulo",
            "Retire o livro na biblioteca em até " . config_sistema('dias_reserva_expira', '3') . " dias.");
    }

    // ------------------- Gamificação: conquistas por leitura -------------------
    $leitorId = (int)$emp['usuario_id'];
    $stmt = db()->prepare("SELECT COUNT(*) FROM emprestimos WHERE usuario_id = ? AND status = 'devolvido'");
    $stmt->execute([$leitorId]);
    $lidos = (int)$stmt->fetchColumn();
    if ($lidos >= 1)  conceder_conquista($leitorId, 'primeiro_livro');
    if ($lidos >= 5)  conceder_conquista($leitorId, 'cinco_livros');
    if ($lidos >= 10) conceder_conquista($leitorId, 'dez_livros');
    if ($lidos >= 20) conceder_conquista($leitorId, 'vinte_livros');

    $stmt = db()->prepare(
        "SELECT COUNT(*) FROM (SELECT data_devolucao, data_prevista FROM emprestimos
          WHERE usuario_id = ? AND status='devolvido' ORDER BY data_devolucao DESC LIMIT 10) t
         WHERE DATE(t.data_devolucao) <= t.data_prevista");
    $stmt->execute([$leitorId]);
    if ((int)$stmt->fetchColumn() >= 10) conceder_conquista($leitorId, 'sem_atraso_10');

    // Conclusão de trilhas: se todos os livros de uma trilha inscrita foram lidos
    $stmt = db()->prepare(
        "SELECT ti.id, ti.trilha_id FROM trilha_inscricoes ti
         WHERE ti.usuario_id = ? AND ti.data_conclusao IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM trilha_livros tl
             WHERE tl.trilha_id = ti.trilha_id
               AND tl.livro_id NOT IN (
                 SELECT x2.livro_id FROM emprestimos e2
                 JOIN exemplares x2 ON x2.id = e2.exemplar_id
                 WHERE e2.usuario_id = ti.usuario_id AND e2.status = 'devolvido'))");
    $stmt->execute([$leitorId]);
    foreach ($stmt->fetchAll() as $trilhaConcluida) {
        db()->prepare("UPDATE trilha_inscricoes SET data_conclusao = NOW() WHERE id = ?")
            ->execute([$trilhaConcluida['id']]);
        conceder_conquista($leitorId, 'primeira_trilha');
        notificar($leitorId, 'trilha_concluida', '🛤️ Trilha de Leitura concluída!',
            'Você completou todos os livros de uma trilha. Que a Palavra continue frutificando!');
    }

    auditar($u['id'], 'emprestimo_devolvido', 'emprestimos', $id, "Exemplar {$emp['codigo']} — $titulo");
    responder(200, ['ok' => true, 'proxima_reserva' => $reserva ?: null]);
}

// POST /api/emprestimos/{id}/renovar
if ($METODO === 'POST' && $id && $acao === 'renovar') {
    $u = exigir_login();

    $stmt = db()->prepare(
        "SELECT e.*, x.livro_id FROM emprestimos e JOIN exemplares x ON x.id = e.exemplar_id WHERE e.id = ?");
    $stmt->execute([$id]);
    $emp = $stmt->fetch();
    if (!$emp) responder(404, ['erro' => 'Empréstimo não encontrado.']);

    // Membro só renova o próprio empréstimo
    if (NIVEIS[$u['papel']] < NIVEIS['bibliotecario'] && (int)$emp['usuario_id'] !== (int)$u['id']) {
        responder(403, ['erro' => 'Você só pode renovar seus próprios empréstimos.']);
    }
    if ($emp['status'] !== 'ativo') {
        responder(409, ['erro' => 'Somente empréstimos ativos e sem atraso podem ser renovados.']);
    }
    $maxRenovacoes = (int)config_sistema('max_renovacoes', '2');
    if ((int)$emp['renovacoes'] >= $maxRenovacoes) {
        responder(409, ['erro' => "Limite de $maxRenovacoes renovações atingido."]);
    }
    // Não renova se há fila de espera pelo livro
    $stmt = db()->prepare("SELECT COUNT(*) FROM reservas WHERE livro_id = ? AND status = 'ativa'");
    $stmt->execute([$emp['livro_id']]);
    if ((int)$stmt->fetchColumn() > 0) {
        responder(409, ['erro' => 'Há leitores na fila de reserva deste livro; a renovação não é permitida.']);
    }

    $dias = (int)config_sistema('dias_por_renovacao', '7');
    db()->prepare(
        "UPDATE emprestimos SET data_prevista = DATE_ADD(data_prevista, INTERVAL ? DAY),
                renovacoes = renovacoes + 1 WHERE id = ?")
        ->execute([$dias, $id]);

    $stmt = db()->prepare("SELECT data_prevista FROM emprestimos WHERE id = ?");
    $stmt->execute([$id]);
    $novaData = $stmt->fetchColumn();

    auditar($u['id'], 'emprestimo_renovado', 'emprestimos', $id, "Nova data: $novaData");
    responder(200, ['ok' => true, 'nova_data_prevista' => $novaData]);
}
