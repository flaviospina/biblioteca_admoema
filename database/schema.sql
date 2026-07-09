-- ============================================================
-- MANÁ — Biblioteca Digital
-- Assembleia de Deus - Ministério Belém - Setor 124 Moema
-- Esquema MySQL (utf8mb4) — compatível com MySQL 5.7+ / MariaDB 10.3+
-- ============================================================

CREATE DATABASE IF NOT EXISTS mana_biblioteca
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE mana_biblioteca;

-- ------------------------------------------------------------
-- USUÁRIOS (4 níveis: admin, gerente, bibliotecario, usuario)
-- ------------------------------------------------------------
CREATE TABLE usuarios (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome           VARCHAR(120) NOT NULL,
  email          VARCHAR(160) NOT NULL UNIQUE,
  senha_hash     VARCHAR(255) NOT NULL,
  telefone       VARCHAR(20)  DEFAULT NULL,
  whatsapp       VARCHAR(20)  DEFAULT NULL,
  papel          ENUM('admin','gerente','bibliotecario','usuario') NOT NULL DEFAULT 'usuario',
  congregacao    VARCHAR(120) DEFAULT 'Setor 124 - Moema',
  status         ENUM('ativo','inativo','bloqueado') NOT NULL DEFAULT 'ativo',
  foto_url       VARCHAR(500) DEFAULT NULL,
  criado_em      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_acesso  DATETIME DEFAULT NULL,
  INDEX idx_usuarios_papel (papel),
  INDEX idx_usuarios_status (status)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- CATEGORIAS DO ACERVO
-- ------------------------------------------------------------
CREATE TABLE categorias (
  id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome   VARCHAR(80) NOT NULL UNIQUE,
  cor    VARCHAR(7)  NOT NULL DEFAULT '#1e3a5f'
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- LIVROS (registro bibliográfico)
-- ------------------------------------------------------------
CREATE TABLE livros (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  isbn            VARCHAR(20)  DEFAULT NULL,
  titulo          VARCHAR(255) NOT NULL,
  subtitulo       VARCHAR(255) DEFAULT NULL,
  autor           VARCHAR(255) NOT NULL,
  editora         VARCHAR(160) DEFAULT NULL,
  ano_publicacao  SMALLINT UNSIGNED DEFAULT NULL,
  edicao          VARCHAR(40)  DEFAULT NULL,
  idioma          VARCHAR(40)  DEFAULT 'Português',
  paginas         SMALLINT UNSIGNED DEFAULT NULL,
  sinopse         TEXT,
  capa_url        VARCHAR(500) DEFAULT NULL,
  categoria_id    INT UNSIGNED DEFAULT NULL,
  localizacao     VARCHAR(80)  DEFAULT NULL COMMENT 'Estante/prateleira física',
  tags            VARCHAR(255) DEFAULT NULL,
  destaque        TINYINT(1) NOT NULL DEFAULT 0,
  criado_por      INT UNSIGNED DEFAULT NULL,
  criado_em       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em   DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL,
  FOREIGN KEY (criado_por)   REFERENCES usuarios(id)   ON DELETE SET NULL,
  INDEX idx_livros_isbn (isbn),
  INDEX idx_livros_titulo (titulo),
  INDEX idx_livros_autor (autor),
  FULLTEXT idx_livros_busca (titulo, subtitulo, autor, tags)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- EXEMPLARES (cópias físicas de cada livro)
-- ------------------------------------------------------------
CREATE TABLE exemplares (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  livro_id           INT UNSIGNED NOT NULL,
  codigo             VARCHAR(30) NOT NULL UNIQUE COMMENT 'Número de tombo/etiqueta',
  estado_conservacao ENUM('otimo','bom','regular','ruim') NOT NULL DEFAULT 'bom',
  status             ENUM('disponivel','emprestado','reservado','manutencao','perdido') NOT NULL DEFAULT 'disponivel',
  origem             ENUM('compra','doacao') NOT NULL DEFAULT 'doacao',
  doador             VARCHAR(120) DEFAULT NULL,
  data_aquisicao     DATE DEFAULT NULL,
  observacao         VARCHAR(255) DEFAULT NULL,
  FOREIGN KEY (livro_id) REFERENCES livros(id) ON DELETE CASCADE,
  INDEX idx_exemplares_status (status)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- EMPRÉSTIMOS (circulação de livros físicos)
-- ------------------------------------------------------------
CREATE TABLE emprestimos (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  exemplar_id      INT UNSIGNED NOT NULL,
  usuario_id       INT UNSIGNED NOT NULL,
  bibliotecario_id INT UNSIGNED DEFAULT NULL COMMENT 'Quem registrou o empréstimo',
  data_emprestimo  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_prevista    DATE NOT NULL,
  data_devolucao   DATETIME DEFAULT NULL,
  renovacoes       TINYINT UNSIGNED NOT NULL DEFAULT 0,
  status           ENUM('ativo','devolvido','atrasado') NOT NULL DEFAULT 'ativo',
  observacao       VARCHAR(255) DEFAULT NULL,
  FOREIGN KEY (exemplar_id)      REFERENCES exemplares(id) ON DELETE RESTRICT,
  FOREIGN KEY (usuario_id)       REFERENCES usuarios(id)   ON DELETE RESTRICT,
  FOREIGN KEY (bibliotecario_id) REFERENCES usuarios(id)   ON DELETE SET NULL,
  INDEX idx_emprestimos_status (status),
  INDEX idx_emprestimos_usuario (usuario_id),
  INDEX idx_emprestimos_prevista (data_prevista)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- RESERVAS (fila de espera por livro)
-- ------------------------------------------------------------
CREATE TABLE reservas (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  livro_id        INT UNSIGNED NOT NULL,
  usuario_id      INT UNSIGNED NOT NULL,
  data_reserva    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_expiracao  DATE DEFAULT NULL COMMENT 'Preenchida quando o livro fica disponível',
  status          ENUM('ativa','disponivel','atendida','cancelada','expirada') NOT NULL DEFAULT 'ativa',
  FOREIGN KEY (livro_id)   REFERENCES livros(id)   ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX idx_reservas_status (status),
  INDEX idx_reservas_usuario (usuario_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- AVALIAÇÕES (notas e comentários dos leitores)
-- ------------------------------------------------------------
CREATE TABLE avaliacoes (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  livro_id    INT UNSIGNED NOT NULL,
  usuario_id  INT UNSIGNED NOT NULL,
  nota        TINYINT UNSIGNED NOT NULL COMMENT '1 a 5',
  comentario  TEXT,
  criado_em   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_avaliacao (livro_id, usuario_id),
  FOREIGN KEY (livro_id)   REFERENCES livros(id)   ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- TRILHAS DE LEITURA (DIFERENCIAL: jornadas de discipulado)
-- ------------------------------------------------------------
CREATE TABLE trilhas (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome       VARCHAR(120) NOT NULL,
  descricao  TEXT,
  icone      VARCHAR(10)  DEFAULT '📖',
  cor        VARCHAR(7)   DEFAULT '#1e3a5f',
  ativa      TINYINT(1)   NOT NULL DEFAULT 1,
  criado_por INT UNSIGNED DEFAULT NULL,
  criado_em  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (criado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE trilha_livros (
  id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  trilha_id INT UNSIGNED NOT NULL,
  livro_id  INT UNSIGNED NOT NULL,
  ordem     TINYINT UNSIGNED NOT NULL DEFAULT 1,
  UNIQUE KEY uq_trilha_livro (trilha_id, livro_id),
  FOREIGN KEY (trilha_id) REFERENCES trilhas(id) ON DELETE CASCADE,
  FOREIGN KEY (livro_id)  REFERENCES livros(id)  ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE trilha_inscricoes (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  trilha_id      INT UNSIGNED NOT NULL,
  usuario_id     INT UNSIGNED NOT NULL,
  data_inscricao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_conclusao DATETIME DEFAULT NULL,
  UNIQUE KEY uq_inscricao (trilha_id, usuario_id),
  FOREIGN KEY (trilha_id)  REFERENCES trilhas(id)  ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- CONQUISTAS / SELOS (gamificação da leitura)
-- ------------------------------------------------------------
CREATE TABLE conquistas (
  id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo    VARCHAR(40) NOT NULL UNIQUE,
  nome      VARCHAR(80) NOT NULL,
  descricao VARCHAR(255) NOT NULL,
  icone     VARCHAR(10) DEFAULT '🏅'
) ENGINE=InnoDB;

CREATE TABLE usuario_conquistas (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id   INT UNSIGNED NOT NULL,
  conquista_id INT UNSIGNED NOT NULL,
  obtida_em    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_usuario_conquista (usuario_id, conquista_id),
  FOREIGN KEY (usuario_id)   REFERENCES usuarios(id)   ON DELETE CASCADE,
  FOREIGN KEY (conquista_id) REFERENCES conquistas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- SUGESTÕES DE AQUISIÇÃO (membros indicam novos títulos)
-- ------------------------------------------------------------
CREATE TABLE sugestoes (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT UNSIGNED NOT NULL,
  titulo     VARCHAR(255) NOT NULL,
  autor      VARCHAR(255) DEFAULT NULL,
  motivo     TEXT,
  status     ENUM('pendente','aprovada','recusada','adquirida') NOT NULL DEFAULT 'pendente',
  criado_em  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- NOTIFICAÇÕES (avisos internos: devolução próxima, reserva liberada…)
-- ------------------------------------------------------------
CREATE TABLE notificacoes (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT UNSIGNED NOT NULL,
  tipo       VARCHAR(40) NOT NULL,
  titulo     VARCHAR(160) NOT NULL,
  mensagem   VARCHAR(500) DEFAULT NULL,
  lida       TINYINT(1) NOT NULL DEFAULT 0,
  criado_em  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX idx_notificacoes_usuario (usuario_id, lida)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- AUDITORIA (rastreabilidade de todas as ações administrativas)
-- ------------------------------------------------------------
CREATE TABLE auditoria (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id  INT UNSIGNED DEFAULT NULL,
  acao        VARCHAR(60) NOT NULL,
  entidade    VARCHAR(40) NOT NULL,
  entidade_id INT UNSIGNED DEFAULT NULL,
  detalhes    VARCHAR(500) DEFAULT NULL,
  criado_em   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX idx_auditoria_entidade (entidade, entidade_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- CONFIGURAÇÕES DO SISTEMA (parametrização sem alterar código)
-- ------------------------------------------------------------
CREATE TABLE configuracoes (
  chave VARCHAR(60) PRIMARY KEY,
  valor VARCHAR(255) NOT NULL,
  descricao VARCHAR(255) DEFAULT NULL
) ENGINE=InnoDB;

-- ============================================================
-- DADOS INICIAIS
-- ============================================================

INSERT INTO configuracoes (chave, valor, descricao) VALUES
  ('prazo_emprestimo_dias',  '14', 'Dias de prazo padrão do empréstimo'),
  ('max_renovacoes',         '2',  'Número máximo de renovações por empréstimo'),
  ('dias_por_renovacao',     '7',  'Dias adicionados a cada renovação'),
  ('max_emprestimos_ativos', '3',  'Máximo de empréstimos simultâneos por usuário'),
  ('dias_reserva_expira',    '3',  'Dias para retirar o livro após a reserva ficar disponível'),
  ('bloqueio_por_atraso',    '1',  'Bloquear novos empréstimos para quem tem atraso (1=sim)');

INSERT INTO categorias (nome, cor) VALUES
  ('Teologia',              '#1e3a5f'),
  ('Estudo Bíblico',        '#2563eb'),
  ('Vida Cristã',           '#0e7490'),
  ('Família',               '#b45309'),
  ('Jovens e Adolescentes', '#7c3aed'),
  ('Infantil',              '#db2777'),
  ('Biografias e Missões',  '#15803d'),
  ('Louvor e Adoração',     '#c2410c'),
  ('Escola Bíblica Dominical', '#4d7c0f'),
  ('Literatura Geral',      '#475569');

INSERT INTO conquistas (codigo, nome, descricao, icone) VALUES
  ('primeiro_livro',   'Primeiros Passos',    'Concluiu seu primeiro empréstimo',                 '🌱'),
  ('cinco_livros',     'Leitor Fiel',         'Leu 5 livros da biblioteca',                       '📚'),
  ('dez_livros',       'Peregrino da Palavra','Leu 10 livros da biblioteca',                      '🕊️'),
  ('vinte_livros',     'Guardião do Maná',    'Leu 20 livros da biblioteca',                      '🏺'),
  ('primeira_trilha',  'Discípulo em Jornada','Concluiu sua primeira Trilha de Leitura',          '🛤️'),
  ('sem_atraso_10',    'Mordomo Exemplar',    '10 devoluções seguidas sem atraso',                '⏰'),
  ('primeira_avaliacao','Voz do Leitor',      'Publicou sua primeira avaliação',                  '⭐');

-- Usuário administrador inicial — senha: mana@2026 (TROQUE APÓS O PRIMEIRO LOGIN)
INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES
  ('Administrador', 'admin@admoema.com.br',
   '$2y$12$cBVGQV0VsEBzeCOytCDGx.wxEm/AnAWO.mvvneTUhg3s4IZ4SfpGe', 'admin');
