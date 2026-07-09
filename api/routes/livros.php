<?php
/** Rotas: /api/livros — catálogo e cadastro do acervo */

$id = isset($segmentos[1]) ? (int)$segmentos[1] : null;

// GET /api/livros?busca=&categoria=&pagina=&destaque=1&disponiveis=1
if ($METODO === 'GET' && !$id) {
    exigir_login();
    atualizar_atrasados();

    $porPagina = 24;
    $pagina    = max(1, (int)($_GET['pagina'] ?? 1));
    $where     = [];
    $params    = [];

    if (!empty($_GET['busca'])) {
        $where[] = "(l.titulo LIKE :busca OR l.autor LIKE :busca OR l.isbn LIKE :busca OR l.tags LIKE :busca)";
        $params['busca'] = '%' . $_GET['busca'] . '%';
    }
    if (!empty($_GET['categoria'])) {
        $where[] = "l.categoria_id = :categoria";
        $params['categoria'] = (int)$_GET['categoria'];
    }
    if (!empty($_GET['destaque'])) {
        $where[] = "l.destaque = 1";
    }
    $sqlWhere = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $sql = "SELECT l.*, c.nome AS categoria_nome, c.cor AS categoria_cor,
              (SELECT COUNT(*) FROM exemplares e WHERE e.livro_id = l.id) AS total_exemplares,
              (SELECT COUNT(*) FROM exemplares e WHERE e.livro_id = l.id AND e.status = 'disponivel') AS disponiveis,
              (SELECT ROUND(AVG(nota),1) FROM avaliacoes a WHERE a.livro_id = l.id) AS nota_media,
              (SELECT COUNT(*) FROM avaliacoes a WHERE a.livro_id = l.id) AS total_avaliacoes
            FROM livros l
            LEFT JOIN categorias c ON c.id = l.categoria_id
            $sqlWhere";

    if (!empty($_GET['disponiveis'])) {
        $sql = "SELECT * FROM ($sql) t WHERE t.disponiveis > 0";
    }
    $sql .= " ORDER BY " . (!empty($_GET['busca']) ? "titulo" : "criado_em DESC, titulo");

    $stmtTotal = db()->prepare("SELECT COUNT(*) FROM ($sql) contagem");
    $stmtTotal->execute($params);
    $total = (int)$stmtTotal->fetchColumn();

    $offset = ($pagina - 1) * $porPagina;
    $stmt = db()->prepare("$sql LIMIT $porPagina OFFSET $offset");
    $stmt->execute($params);

    responder(200, [
        'livros'  => $stmt->fetchAll(),
        'total'   => $total,
        'pagina'  => $pagina,
        'paginas' => (int)ceil($total / $porPagina),
    ]);
}

// GET /api/livros/{id} — detalhe com exemplares, avaliações e fila de reserva
if ($METODO === 'GET' && $id) {
    $u = exigir_login();
    atualizar_atrasados();

    $stmt = db()->prepare(
        "SELECT l.*, c.nome AS categoria_nome, c.cor AS categoria_cor,
           (SELECT ROUND(AVG(nota),1) FROM avaliacoes a WHERE a.livro_id = l.id) AS nota_media
         FROM livros l LEFT JOIN categorias c ON c.id = l.categoria_id WHERE l.id = ?");
    $stmt->execute([$id]);
    $livro = $stmt->fetch();
    if (!$livro) responder(404, ['erro' => 'Livro não encontrado.']);

    $stmt = db()->prepare("SELECT * FROM exemplares WHERE livro_id = ? ORDER BY codigo");
    $stmt->execute([$id]);
    $livro['exemplares'] = $stmt->fetchAll();

    $stmt = db()->prepare(
        "SELECT a.id, a.nota, a.comentario, a.criado_em, u.nome AS usuario_nome, a.usuario_id
         FROM avaliacoes a JOIN usuarios u ON u.id = a.usuario_id
         WHERE a.livro_id = ? ORDER BY a.criado_em DESC LIMIT 50");
    $stmt->execute([$id]);
    $livro['avaliacoes'] = $stmt->fetchAll();

    $stmt = db()->prepare("SELECT COUNT(*) FROM reservas WHERE livro_id = ? AND status IN ('ativa','disponivel')");
    $stmt->execute([$id]);
    $livro['fila_reservas'] = (int)$stmt->fetchColumn();

    $stmt = db()->prepare("SELECT id, status FROM reservas WHERE livro_id = ? AND usuario_id = ? AND status IN ('ativa','disponivel')");
    $stmt->execute([$id, $u['id']]);
    $livro['minha_reserva'] = $stmt->fetch() ?: null;

    responder(200, ['livro' => $livro]);
}

// POST /api/livros — cadastro (manual, por ISBN ou via foto+autofill no frontend)
if ($METODO === 'POST' && !$id) {
    $u = exigir_papel('bibliotecario');
    $dados = entrada();
    if (empty($dados['titulo']) || empty($dados['autor'])) {
        responder(422, ['erro' => 'Título e autor são obrigatórios.']);
    }

    // Evita duplicidade por ISBN: se já existe, apenas soma exemplares
    $livroExistente = null;
    if (!empty($dados['isbn'])) {
        $stmt = db()->prepare("SELECT id FROM livros WHERE isbn = ?");
        $stmt->execute([$dados['isbn']]);
        $livroExistente = $stmt->fetchColumn();
    }

    if ($livroExistente) {
        $livroId = (int)$livroExistente;
    } else {
        $stmt = db()->prepare(
            "INSERT INTO livros (isbn, titulo, subtitulo, autor, editora, ano_publicacao, edicao, idioma,
                                 paginas, sinopse, capa_url, categoria_id, localizacao, tags, destaque, criado_por)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
        $stmt->execute([
            $dados['isbn'] ?: null,
            trim($dados['titulo']),
            $dados['subtitulo'] ?? null,
            trim($dados['autor']),
            $dados['editora'] ?? null,
            $dados['ano_publicacao'] ?: null,
            $dados['edicao'] ?? null,
            $dados['idioma'] ?? 'Português',
            $dados['paginas'] ?: null,
            $dados['sinopse'] ?? null,
            $dados['capa_url'] ?? null,
            $dados['categoria_id'] ?: null,
            $dados['localizacao'] ?? null,
            $dados['tags'] ?? null,
            !empty($dados['destaque']) ? 1 : 0,
            $u['id'],
        ]);
        $livroId = (int)db()->lastInsertId();
    }

    // Cria os exemplares físicos (padrão: 1)
    $qtd = max(1, min(50, (int)($dados['quantidade_exemplares'] ?? 1)));
    $criados = [];
    for ($i = 0; $i < $qtd; $i++) {
        $codigo = sprintf('MN-%05d-%02d', $livroId, $i + 1);
        // Garante código único mesmo somando exemplares a livro existente
        $tentativa = 0;
        while ($tentativa < 100) {
            $stmt = db()->prepare("SELECT 1 FROM exemplares WHERE codigo = ?");
            $stmt->execute([$codigo]);
            if (!$stmt->fetch()) break;
            $tentativa++;
            $codigo = sprintf('MN-%05d-%02d', $livroId, $i + 1 + $tentativa);
        }
        $stmt = db()->prepare(
            "INSERT INTO exemplares (livro_id, codigo, origem, doador, data_aquisicao)
             VALUES (?,?,?,?,CURDATE())");
        $stmt->execute([
            $livroId, $codigo,
            $dados['origem'] ?? 'doacao',
            $dados['doador'] ?? null,
        ]);
        $criados[] = $codigo;
    }

    auditar($u['id'], $livroExistente ? 'exemplares_adicionados' : 'livro_cadastrado', 'livros', $livroId,
        "{$dados['titulo']} ($qtd exemplar(es): " . implode(', ', $criados) . ")");

    responder(201, [
        'id' => $livroId,
        'ja_existia' => (bool)$livroExistente,
        'exemplares_criados' => $criados,
    ]);
}

// PUT /api/livros/{id}
if ($METODO === 'PUT' && $id) {
    $u = exigir_papel('bibliotecario');
    $dados = entrada();
    $stmt = db()->prepare(
        "UPDATE livros SET isbn=?, titulo=?, subtitulo=?, autor=?, editora=?, ano_publicacao=?, edicao=?,
                idioma=?, paginas=?, sinopse=?, capa_url=?, categoria_id=?, localizacao=?, tags=?, destaque=?
         WHERE id=?");
    $stmt->execute([
        $dados['isbn'] ?: null,
        trim($dados['titulo'] ?? ''),
        $dados['subtitulo'] ?? null,
        trim($dados['autor'] ?? ''),
        $dados['editora'] ?? null,
        $dados['ano_publicacao'] ?: null,
        $dados['edicao'] ?? null,
        $dados['idioma'] ?? 'Português',
        $dados['paginas'] ?: null,
        $dados['sinopse'] ?? null,
        $dados['capa_url'] ?? null,
        $dados['categoria_id'] ?: null,
        $dados['localizacao'] ?? null,
        $dados['tags'] ?? null,
        !empty($dados['destaque']) ? 1 : 0,
        $id,
    ]);
    auditar($u['id'], 'livro_editado', 'livros', $id, $dados['titulo'] ?? null);
    responder(200, ['ok' => true]);
}

// DELETE /api/livros/{id} — somente gerente/admin
if ($METODO === 'DELETE' && $id) {
    $u = exigir_papel('gerente');
    $stmt = db()->prepare(
        "SELECT COUNT(*) FROM emprestimos e JOIN exemplares x ON x.id = e.exemplar_id
         WHERE x.livro_id = ? AND e.status IN ('ativo','atrasado')");
    $stmt->execute([$id]);
    if ($stmt->fetchColumn() > 0) {
        responder(409, ['erro' => 'Não é possível excluir: há exemplares deste livro emprestados.']);
    }
    db()->prepare("DELETE FROM livros WHERE id = ?")->execute([$id]);
    auditar($u['id'], 'livro_excluido', 'livros', $id);
    responder(200, ['ok' => true]);
}
