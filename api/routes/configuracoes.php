<?php
/** Rotas: /api/configuracoes — parâmetros de circulação (admin) */

if ($METODO === 'GET') {
    exigir_papel('bibliotecario');
    $config = db()->query("SELECT chave, valor, descricao FROM configuracoes ORDER BY chave")->fetchAll();
    responder(200, ['configuracoes' => $config]);
}

if ($METODO === 'PUT') {
    $u = exigir_papel('admin');
    $dados = entrada();
    foreach ($dados as $chave => $valor) {
        $stmt = db()->prepare("UPDATE configuracoes SET valor = ? WHERE chave = ?");
        $stmt->execute([(string)$valor, $chave]);
    }
    auditar($u['id'], 'configuracoes_alteradas', 'configuracoes', null, json_encode($dados, JSON_UNESCAPED_UNICODE));
    responder(200, ['ok' => true]);
}
