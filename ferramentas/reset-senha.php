<?php
/**
 * ============================================================
 *  MANÁ — Biblioteca Digital | Página de reset de senha
 * ============================================================
 *  USO ÚNICO / EMERGENCIAL. Passo a passo:
 *
 *  1. Troque o valor de CHAVE_ACESSO abaixo por um código secreto seu.
 *  2. Envie este arquivo para a pasta do sistema no servidor
 *     (ao lado da pasta "api"), ex.:
 *        public_html/biblioteca_digital/reset-senha.php
 *  3. Acesse no navegador:
 *        https://www.admoema.com.br/biblioteca_digital/reset-senha.php?chave=SEU_CODIGO
 *  4. Use o formulário para definir a nova senha.
 *  5. >>> APAGUE ESTE ARQUIVO DO SERVIDOR DEPOIS DE USAR <<<
 *
 *  Ele usa o MESMO config.php do sistema, então acerta sempre o banco
 *  correto — e redefine a senha pelo próprio PHP (sem copiar/colar hash).
 * ============================================================
 */

// >>> TROQUE por um código secreto antes de enviar ao servidor <<<
const CHAVE_ACESSO = 'maná-reset-2026';

// Carrega a configuração do próprio sistema (mesma conexão do site)
$cfgPath = __DIR__ . '/api/config.php';
if (!file_exists($cfgPath)) {
    // tenta também o caso de o arquivo estar dentro de /api
    $cfgPath = __DIR__ . '/config.php';
}
$erroFatal = null;
$pdo = null;
if (!file_exists($cfgPath)) {
    $erroFatal = 'Não encontrei o config.php. Coloque este arquivo na mesma pasta que contém a pasta "api".';
} else {
    $cfg = require $cfgPath;
    try {
        $pdo = new PDO(
            "mysql:host={$cfg['db_host']};dbname={$cfg['db_name']};charset=utf8mb4",
            $cfg['db_user'], $cfg['db_pass'],
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
        );
    } catch (Throwable $e) {
        $erroFatal = 'Falha ao conectar no banco: ' . $e->getMessage();
    }
}

// Proteção por chave
$chave = $_GET['chave'] ?? $_POST['chave'] ?? '';
$autorizado = hash_equals(CHAVE_ACESSO, (string)$chave);

$mensagem = null;
$tipoMsg = 'info';

// Processa o reset
if ($pdo && $autorizado && $_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['acao'] ?? '') === 'resetar') {
    $email = trim($_POST['email'] ?? '');
    $nova  = (string)($_POST['nova_senha'] ?? '');
    if ($email === '' || strlen($nova) < 6) {
        $mensagem = 'Informe o e-mail e uma senha com pelo menos 6 caracteres.';
        $tipoMsg = 'erro';
    } else {
        // Garante que a coluna comporta o hash (60 caracteres)
        try { $pdo->exec("ALTER TABLE usuarios MODIFY senha_hash VARCHAR(255) NOT NULL"); } catch (Throwable $e) {}

        $hash = password_hash($nova, PASSWORD_BCRYPT);
        $stmt = $pdo->prepare("UPDATE usuarios SET senha_hash = ?, status = 'ativo' WHERE email = ?");
        $stmt->execute([$hash, $email]);
        $afetados = $stmt->rowCount();

        if ($afetados > 0) {
            // Confirma que o novo hash realmente valida a senha informada
            $ok = password_verify($nova, $hash);
            $mensagem = "Senha de <b>" . htmlspecialchars($email) . "</b> alterada com sucesso"
                . ($ok ? ' e verificada ✓' : '') . ". Já pode entrar no sistema. "
                . "<b>Agora apague este arquivo do servidor.</b>";
            $tipoMsg = 'ok';
        } else {
            $mensagem = "Nenhum usuário com o e-mail <b>" . htmlspecialchars($email) . "</b> foi encontrado neste banco. "
                . "Veja na lista abaixo os e-mails que existem de verdade (atenção a espaços e maiúsculas).";
            $tipoMsg = 'erro';
        }
    }
}

// Lista de usuários (diagnóstico)
$usuarios = [];
if ($pdo && $autorizado) {
    try {
        $usuarios = $pdo->query(
            "SELECT id, nome, email, papel, status, CHAR_LENGTH(senha_hash) AS tam_hash
             FROM usuarios ORDER BY FIELD(papel,'admin','gerente','bibliotecario','usuario'), nome"
        )->fetchAll();
    } catch (Throwable $e) {
        $erroFatal = 'Erro ao listar usuários: ' . $e->getMessage();
    }
}
?>
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MANÁ — Reset de senha</title>
<style>
  :root{--azul:#16345c;--azul6:#2563eb;--dourado:#d97706;--borda:#e4e8f0;--txt:#1a2333;--txt2:#55617a;}
  *{box-sizing:border-box;}
  body{margin:0;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;background:#f4f6fb;color:var(--txt);padding:24px;}
  .box{max-width:680px;margin:0 auto;}
  .card{background:#fff;border:1px solid var(--borda);border-radius:16px;box-shadow:0 10px 30px -16px rgba(15,36,64,.3);padding:26px;margin-bottom:20px;}
  h1{font-size:1.5rem;margin:0 0 4px;}
  .sub{color:var(--txt2);font-size:.9rem;margin-bottom:18px;}
  label{display:block;font-weight:600;font-size:.85rem;color:var(--txt2);margin:14px 0 5px;}
  input{width:100%;padding:11px 13px;border:1.5px solid var(--borda);border-radius:10px;font-size:1rem;}
  input:focus{outline:none;border-color:var(--azul6);box-shadow:0 0 0 3px #dbeafe;}
  button{margin-top:18px;width:100%;padding:12px;border:none;border-radius:10px;background:var(--azul6);color:#fff;font-size:1rem;font-weight:700;cursor:pointer;}
  button:hover{filter:brightness(1.08);}
  .aviso{padding:13px 16px;border-radius:10px;font-size:.92rem;margin-bottom:16px;line-height:1.5;}
  .aviso.ok{background:#dcfce7;color:#15803d;}
  .aviso.erro{background:#fee2e2;color:#b91c1c;}
  .aviso.info{background:#dbeafe;color:#1d4479;}
  .aviso.alerta{background:#fef3c7;color:#92400e;border:1px solid #d97706;}
  table{width:100%;border-collapse:collapse;font-size:.85rem;margin-top:8px;}
  th{text-align:left;background:#f8fafd;color:var(--txt2);padding:8px 10px;font-size:.72rem;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid var(--borda);}
  td{padding:8px 10px;border-bottom:1px solid var(--borda);}
  .chip{display:inline-block;font-size:.72rem;font-weight:700;padding:2px 8px;border-radius:99px;}
  .chip.ativo{background:#dcfce7;color:#15803d;}
  .chip.inativo{background:#eef1f6;color:#55617a;}
  .marca{font-family:Georgia,serif;font-weight:700;color:var(--azul);letter-spacing:1px;}
  code{background:#eef1f6;padding:2px 6px;border-radius:5px;}
</style>
</head>
<body>
<div class="box">
  <div class="card">
    <h1>🍞 <span class="marca">MANÁ</span> — Reset de senha</h1>
    <div class="sub">Ferramenta de emergência · Assembleia de Deus · Ministério Belém — Setor 124 Moema</div>

    <?php if ($erroFatal): ?>
      <div class="aviso erro"><?= htmlspecialchars($erroFatal) ?></div>
    <?php endif; ?>

    <?php if (!$autorizado): ?>
      <div class="aviso erro">
        Acesso negado. Adicione o código secreto ao endereço:
        <br><code>reset-senha.php?chave=SEU_CODIGO</code>
        <br><br>O código é definido na constante <code>CHAVE_ACESSO</code>, no topo deste arquivo.
      </div>
    <?php else: ?>

      <?php if ($mensagem): ?>
        <div class="aviso <?= $tipoMsg ?>"><?= $mensagem ?></div>
      <?php endif; ?>

      <?php if ($pdo): ?>
      <form method="post">
        <input type="hidden" name="acao" value="resetar">
        <input type="hidden" name="chave" value="<?= htmlspecialchars($chave) ?>">
        <label>E-mail do usuário</label>
        <input type="email" name="email" value="<?= htmlspecialchars($_POST['email'] ?? 'admin@admoema.com.br') ?>" required>
        <label>Nova senha (mínimo 6 caracteres)</label>
        <input type="text" name="nova_senha" value="ADMoema2026@01" required minlength="6">
        <button type="submit">Alterar senha</button>
      </form>
      <?php endif; ?>

      <div class="aviso alerta" style="margin-top:20px">
        ⚠️ <b>Importante:</b> por segurança, <b>apague este arquivo</b> (<code>reset-senha.php</code>)
        do servidor assim que terminar.
      </div>
    <?php endif; ?>
  </div>

  <?php if ($autorizado && $usuarios): ?>
  <div class="card">
    <h1 style="font-size:1.1rem">Usuários neste banco</h1>
    <div class="sub">Diagnóstico — confira o e-mail exato, o status e o tamanho do hash (deve ser 60).</div>
    <table>
      <thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Status</th><th>Hash</th></tr></thead>
      <tbody>
      <?php foreach ($usuarios as $u): ?>
        <tr>
          <td><?= htmlspecialchars($u['nome']) ?></td>
          <td><code><?= htmlspecialchars($u['email']) ?></code></td>
          <td><?= htmlspecialchars($u['papel']) ?></td>
          <td><span class="chip <?= $u['status'] === 'ativo' ? 'ativo' : 'inativo' ?>"><?= htmlspecialchars($u['status']) ?></span></td>
          <td style="<?= (int)$u['tam_hash'] === 60 ? '' : 'color:#b91c1c;font-weight:700' ?>"><?= (int)$u['tam_hash'] ?></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>
  <?php endif; ?>
</div>
</body>
</html>
