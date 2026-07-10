<?php
/**
 * MANÁ — Biblioteca Digital | Núcleo da API
 * Conexão PDO, autenticação JWT (HMAC-SHA256), respostas JSON,
 * controle de papéis e auditoria.
 */

// ---------------------------------------------------------------- Config
function config(): array
{
    static $cfg = null;
    if ($cfg === null) {
        $arquivo = __DIR__ . '/../config.php';
        if (!file_exists($arquivo)) {
            responder(500, ['erro' => 'config.php não encontrado. Copie config.example.php para config.php e preencha os dados.']);
        }
        $cfg = require $arquivo;
    }
    return $cfg;
}

// ---------------------------------------------------------------- Banco
function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $cfg = config();
        try {
            $pdo = new PDO(
                "mysql:host={$cfg['db_host']};dbname={$cfg['db_name']};charset=utf8mb4",
                $cfg['db_user'],
                $cfg['db_pass'],
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                ]
            );
        } catch (PDOException $e) {
            responder(500, ['erro' => 'Falha na conexão com o banco de dados.', 'detalhe' => $e->getMessage()]);
        }
    }
    return $pdo;
}

// ---------------------------------------------------------------- Resposta
function responder(int $status, $dados): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($dados, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function entrada(): array
{
    $json = json_decode(file_get_contents('php://input'), true);
    return is_array($json) ? $json : [];
}

// ---------------------------------------------------------------- JWT
function base64url(string $dados): string
{
    return rtrim(strtr(base64_encode($dados), '+/', '-_'), '=');
}

function jwt_criar(array $payload): string
{
    $cfg = config();
    $payload['exp'] = time() + ($cfg['jwt_dias'] * 86400);
    $header  = base64url(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $corpo   = base64url(json_encode($payload));
    $assinatura = base64url(hash_hmac('sha256', "$header.$corpo", $cfg['jwt_secret'], true));
    return "$header.$corpo.$assinatura";
}

function jwt_verificar(string $token): ?array
{
    $cfg = config();
    $partes = explode('.', $token);
    if (count($partes) !== 3) return null;
    [$header, $corpo, $assinatura] = $partes;
    $esperada = base64url(hash_hmac('sha256', "$header.$corpo", $cfg['jwt_secret'], true));
    if (!hash_equals($esperada, $assinatura)) return null;
    $payload = json_decode(base64_decode(strtr($corpo, '-_', '+/')), true);
    if (!is_array($payload) || ($payload['exp'] ?? 0) < time()) return null;
    return $payload;
}

// ---------------------------------------------------------------- Autenticação e papéis
const NIVEIS = ['usuario' => 1, 'bibliotecario' => 2, 'gerente' => 3, 'admin' => 4];

function usuario_logado(): ?array
{
    static $usuario = false;
    if ($usuario !== false) return $usuario;

    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/Bearer\s+(\S+)/', $auth, $m)) return $usuario = null;

    $payload = jwt_verificar($m[1]);
    if (!$payload) return $usuario = null;

    $stmt = db()->prepare("SELECT id, nome, email, telefone, whatsapp, papel, congregacao, status, foto_url FROM usuarios WHERE id = ?");
    $stmt->execute([$payload['uid']]);
    $u = $stmt->fetch();
    if (!$u || $u['status'] !== 'ativo') return $usuario = null;
    return $usuario = $u;
}

function exigir_login(): array
{
    $u = usuario_logado();
    if (!$u) responder(401, ['erro' => 'Sessão inválida ou expirada. Faça login novamente.']);
    return $u;
}

function exigir_papel(string $papelMinimo): array
{
    $u = exigir_login();
    if (NIVEIS[$u['papel']] < NIVEIS[$papelMinimo]) {
        responder(403, ['erro' => 'Você não tem permissão para esta ação.']);
    }
    return $u;
}

// ---------------------------------------------------------------- Auditoria
function auditar(?int $usuarioId, string $acao, string $entidade, ?int $entidadeId = null, ?string $detalhes = null): void
{
    $stmt = db()->prepare("INSERT INTO auditoria (usuario_id, acao, entidade, entidade_id, detalhes) VALUES (?,?,?,?,?)");
    $stmt->execute([$usuarioId, $acao, $entidade, $entidadeId, $detalhes ? mb_substr($detalhes, 0, 500) : null]);
}

// ---------------------------------------------------------------- Notificações e conquistas
function notificar(int $usuarioId, string $tipo, string $titulo, ?string $mensagem = null): void
{
    $stmt = db()->prepare("INSERT INTO notificacoes (usuario_id, tipo, titulo, mensagem) VALUES (?,?,?,?)");
    $stmt->execute([$usuarioId, $tipo, $titulo, $mensagem]);
}

function conceder_conquista(int $usuarioId, string $codigo): void
{
    $db = db();
    $stmt = $db->prepare("SELECT id, nome, icone FROM conquistas WHERE codigo = ?");
    $stmt->execute([$codigo]);
    $c = $stmt->fetch();
    if (!$c) return;
    $stmt = $db->prepare("INSERT IGNORE INTO usuario_conquistas (usuario_id, conquista_id) VALUES (?,?)");
    $stmt->execute([$usuarioId, $c['id']]);
    if ($stmt->rowCount() > 0) {
        notificar($usuarioId, 'conquista', "{$c['icone']} Nova conquista: {$c['nome']}", 'Parabéns! Continue alimentando sua fé com boas leituras.');
    }
}

// ---------------------------------------------------------------- Foto de perfil
/**
 * Recebe uma imagem em data-URL (base64), valida, grava em api/uploads/
 * e atualiza o foto_url do usuário. Retorna o caminho relativo salvo.
 */
function salvar_foto_usuario(int $usuarioId, string $dataUrl): string
{
    if (!preg_match('#^data:image/(jpeg|jpg|png|webp);base64,#i', $dataUrl, $m)) {
        responder(422, ['erro' => 'Envie a foto em formato JPEG, PNG ou WebP.']);
    }
    $binario = base64_decode(substr($dataUrl, strpos($dataUrl, ',') + 1), true);
    if ($binario === false || strlen($binario) > 3 * 1024 * 1024) {
        responder(422, ['erro' => 'Imagem inválida ou maior que 3 MB.']);
    }
    if (@getimagesizefromstring($binario) === false) {
        responder(422, ['erro' => 'O arquivo enviado não é uma imagem válida.']);
    }

    $dir = __DIR__ . '/../uploads';
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
        responder(500, ['erro' => 'Não foi possível criar a pasta de uploads no servidor.']);
    }

    // Remove fotos antigas do mesmo usuário e grava a nova (nome com carimbo p/ evitar cache)
    foreach (glob("$dir/usuario_{$usuarioId}_*") ?: [] as $antiga) {
        @unlink($antiga);
    }
    $ext  = strtolower($m[1]) === 'png' ? 'png' : (strtolower($m[1]) === 'webp' ? 'webp' : 'jpg');
    $nome = "usuario_{$usuarioId}_" . time() . ".$ext";
    if (file_put_contents("$dir/$nome", $binario) === false) {
        responder(500, ['erro' => 'Falha ao gravar a foto no servidor (permissão da pasta uploads).']);
    }

    $url = "api/uploads/$nome";
    db()->prepare("UPDATE usuarios SET foto_url = ? WHERE id = ?")->execute([$url, $usuarioId]);
    return $url;
}

// ---------------------------------------------------------------- Configurações do sistema
function config_sistema(string $chave, string $padrao = ''): string
{
    static $cache = null;
    if ($cache === null) {
        $cache = [];
        foreach (db()->query("SELECT chave, valor FROM configuracoes") as $linha) {
            $cache[$linha['chave']] = $linha['valor'];
        }
    }
    return $cache[$chave] ?? $padrao;
}

// ---------------------------------------------------------------- Rotinas automáticas de circulação
/** Marca empréstimos vencidos como atrasados (executada a cada requisição relevante). */
function atualizar_atrasados(): void
{
    db()->exec("UPDATE emprestimos SET status='atrasado' WHERE status='ativo' AND data_prevista < CURDATE()");
    db()->exec("UPDATE reservas SET status='expirada' WHERE status='disponivel' AND data_expiracao < CURDATE()");
}
