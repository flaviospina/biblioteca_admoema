<?php
/** Rota: GET /api/minha-estante — visão completa do leitor:
 *  empréstimos ativos, histórico, reservas, conquistas e estatísticas */

if ($METODO !== 'GET') responder(405, ['erro' => 'Método não permitido.']);
$u = exigir_login();
atualizar_atrasados();

$db = db();

$stmt = $db->prepare(
    "SELECT e.*, l.id AS livro_id, l.titulo, l.autor, l.capa_url, x.codigo AS exemplar_codigo,
            DATEDIFF(e.data_prevista, CURDATE()) AS dias_restantes
     FROM emprestimos e
     JOIN exemplares x ON x.id = e.exemplar_id
     JOIN livros l ON l.id = x.livro_id
     WHERE e.usuario_id = ? AND e.status IN ('ativo','atrasado')
     ORDER BY e.data_prevista");
$stmt->execute([$u['id']]);
$ativos = $stmt->fetchAll();

$stmt = $db->prepare(
    "SELECT e.*, l.id AS livro_id, l.titulo, l.autor, l.capa_url,
            (SELECT nota FROM avaliacoes a WHERE a.livro_id = l.id AND a.usuario_id = e.usuario_id) AS minha_nota
     FROM emprestimos e
     JOIN exemplares x ON x.id = e.exemplar_id
     JOIN livros l ON l.id = x.livro_id
     WHERE e.usuario_id = ? AND e.status = 'devolvido'
     ORDER BY e.data_devolucao DESC LIMIT 100");
$stmt->execute([$u['id']]);
$historico = $stmt->fetchAll();

$stmt = $db->prepare(
    "SELECT r.*, l.titulo, l.autor, l.capa_url,
       (SELECT COUNT(*) + 1 FROM reservas r2
         WHERE r2.livro_id = r.livro_id AND r2.status = 'ativa' AND r2.data_reserva < r.data_reserva) AS posicao_fila
     FROM reservas r JOIN livros l ON l.id = r.livro_id
     WHERE r.usuario_id = ? AND r.status IN ('ativa','disponivel')
     ORDER BY r.data_reserva");
$stmt->execute([$u['id']]);
$reservas = $stmt->fetchAll();

$stmt = $db->prepare(
    "SELECT c.nome, c.descricao, c.icone, uc.obtida_em
     FROM usuario_conquistas uc JOIN conquistas c ON c.id = uc.conquista_id
     WHERE uc.usuario_id = ? ORDER BY uc.obtida_em DESC");
$stmt->execute([$u['id']]);
$conquistas = $stmt->fetchAll();

$stmt = $db->prepare(
    "SELECT t.id, t.nome, t.icone, t.cor, ti.data_inscricao, ti.data_conclusao,
       (SELECT COUNT(*) FROM trilha_livros tl WHERE tl.trilha_id = t.id) AS total_livros
     FROM trilha_inscricoes ti JOIN trilhas t ON t.id = ti.trilha_id
     WHERE ti.usuario_id = ? ORDER BY ti.data_inscricao DESC");
$stmt->execute([$u['id']]);
$trilhas = $stmt->fetchAll();

responder(200, [
    'emprestimos_ativos' => $ativos,
    'historico'          => $historico,
    'reservas'           => $reservas,
    'conquistas'         => $conquistas,
    'trilhas'            => $trilhas,
    'estatisticas'       => [
        'livros_lidos'   => count($historico),
        'paginas_estimadas' => null,
        'membro_desde'   => null,
    ],
]);
