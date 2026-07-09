<?php
/** Rota: GET /api/dashboard — indicadores da área administrativa */

if ($METODO !== 'GET') responder(405, ['erro' => 'Método não permitido.']);
exigir_papel('bibliotecario');
atualizar_atrasados();

$db = db();

// ------------------------- Totais gerais
$totais = [
    'livros'             => (int)$db->query("SELECT COUNT(*) FROM livros")->fetchColumn(),
    'exemplares'         => (int)$db->query("SELECT COUNT(*) FROM exemplares")->fetchColumn(),
    'exemplares_disponiveis' => (int)$db->query("SELECT COUNT(*) FROM exemplares WHERE status='disponivel'")->fetchColumn(),
    'usuarios_ativos'    => (int)$db->query("SELECT COUNT(*) FROM usuarios WHERE status='ativo'")->fetchColumn(),
    'emprestimos_ativos' => (int)$db->query("SELECT COUNT(*) FROM emprestimos WHERE status='ativo'")->fetchColumn(),
    'emprestimos_atrasados' => (int)$db->query("SELECT COUNT(*) FROM emprestimos WHERE status='atrasado'")->fetchColumn(),
    'reservas_ativas'    => (int)$db->query("SELECT COUNT(*) FROM reservas WHERE status IN ('ativa','disponivel')")->fetchColumn(),
    'emprestimos_mes'    => (int)$db->query("SELECT COUNT(*) FROM emprestimos WHERE data_emprestimo >= DATE_FORMAT(CURDATE(),'%Y-%m-01')")->fetchColumn(),
    'sugestoes_pendentes'=> (int)$db->query("SELECT COUNT(*) FROM sugestoes WHERE status='pendente'")->fetchColumn(),
    'trilhas_ativas'     => (int)$db->query("SELECT COUNT(*) FROM trilhas WHERE ativa=1")->fetchColumn(),
];

// ------------------------- Empréstimos por mês (últimos 12 meses)
$porMes = $db->query(
    "SELECT DATE_FORMAT(data_emprestimo, '%Y-%m') AS mes, COUNT(*) AS total
     FROM emprestimos
     WHERE data_emprestimo >= DATE_SUB(DATE_FORMAT(CURDATE(),'%Y-%m-01'), INTERVAL 11 MONTH)
     GROUP BY mes ORDER BY mes")->fetchAll();

// ------------------------- Livros mais emprestados
$topLivros = $db->query(
    "SELECT l.id, l.titulo, l.autor, l.capa_url, COUNT(*) AS total
     FROM emprestimos e
     JOIN exemplares x ON x.id = e.exemplar_id
     JOIN livros l ON l.id = x.livro_id
     GROUP BY l.id ORDER BY total DESC LIMIT 8")->fetchAll();

// ------------------------- Empréstimos por categoria
$porCategoria = $db->query(
    "SELECT COALESCE(c.nome,'Sem categoria') AS categoria, COALESCE(c.cor,'#94a3b8') AS cor, COUNT(*) AS total
     FROM emprestimos e
     JOIN exemplares x ON x.id = e.exemplar_id
     JOIN livros l ON l.id = x.livro_id
     LEFT JOIN categorias c ON c.id = l.categoria_id
     GROUP BY c.id ORDER BY total DESC LIMIT 10")->fetchAll();

// ------------------------- Leitores mais assíduos
$topLeitores = $db->query(
    "SELECT u.id, u.nome, COUNT(*) AS total,
       (SELECT COUNT(*) FROM usuario_conquistas uc WHERE uc.usuario_id = u.id) AS conquistas
     FROM emprestimos e JOIN usuarios u ON u.id = e.usuario_id
     WHERE e.status = 'devolvido'
     GROUP BY u.id ORDER BY total DESC LIMIT 8")->fetchAll();

// ------------------------- Devoluções previstas para os próximos 7 dias
$devolucoesProximas = $db->query(
    "SELECT e.id, e.data_prevista, l.titulo, u.nome AS usuario_nome, u.whatsapp
     FROM emprestimos e
     JOIN exemplares x ON x.id = e.exemplar_id
     JOIN livros l ON l.id = x.livro_id
     JOIN usuarios u ON u.id = e.usuario_id
     WHERE e.status = 'ativo' AND e.data_prevista BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
     ORDER BY e.data_prevista LIMIT 20")->fetchAll();

// ------------------------- Atrasos (para cobrança)
$atrasados = $db->query(
    "SELECT e.id, e.data_prevista, DATEDIFF(CURDATE(), e.data_prevista) AS dias_atraso,
            l.titulo, u.nome AS usuario_nome, u.whatsapp
     FROM emprestimos e
     JOIN exemplares x ON x.id = e.exemplar_id
     JOIN livros l ON l.id = x.livro_id
     JOIN usuarios u ON u.id = e.usuario_id
     WHERE e.status = 'atrasado'
     ORDER BY dias_atraso DESC LIMIT 20")->fetchAll();

// ------------------------- Atividade recente
$atividade = $db->query(
    "SELECT a.acao, a.entidade, a.detalhes, a.criado_em, u.nome AS usuario_nome
     FROM auditoria a LEFT JOIN usuarios u ON u.id = a.usuario_id
     ORDER BY a.criado_em DESC LIMIT 15")->fetchAll();

responder(200, [
    'totais'              => $totais,
    'emprestimos_por_mes' => $porMes,
    'top_livros'          => $topLivros,
    'por_categoria'       => $porCategoria,
    'top_leitores'        => $topLeitores,
    'devolucoes_proximas' => $devolucoesProximas,
    'atrasados'           => $atrasados,
    'atividade_recente'   => $atividade,
]);
