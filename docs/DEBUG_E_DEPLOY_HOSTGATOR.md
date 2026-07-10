# 🛠️ MANÁ — Guia de Debug e Publicação na HostGator

Este documento ensina, passo a passo:

1. [Como fazer o debug do projeto](#parte-1--como-fazer-o-debug-do-projeto) (encontrar e corrigir problemas)
2. [Como publicar na HostGator](#parte-2--publicar-na-hostgator) em `www.admoema.com.br/biblioteca_digital`
3. [Problemas comuns e soluções](#parte-3--problemas-comuns-no-servidor)

---

## Parte 1 — Como fazer o DEBUG do projeto

O sistema tem 3 camadas, e cada uma tem sua própria forma de depurar.
**Regra de ouro: descubra primeiro EM QUAL camada está o problema.**

```
[Navegador / React]  →  [API PHP]  →  [Banco MySQL]
```

### 1.1 Debug do frontend (React) no navegador

1. Abra o sistema no **Chrome** e pressione **F12** (DevTools).
2. Aba **Console**: erros de JavaScript aparecem em vermelho. A linha indica
   o arquivo e a posição do erro.
3. Aba **Network (Rede)**: mostra cada chamada que o React faz à API.
   - Clique em uma chamada (ex.: `livros?...`) e veja:
     - **Status**: `200` ok · `401` sessão expirada · `403` sem permissão ·
       `404` rota não existe · `422` dado inválido · `500` erro no PHP/banco
     - **Response**: a API do MANÁ **sempre responde JSON com o campo `erro`**
       explicando o que aconteceu. Ex.: `{"erro":"Este leitor já atingiu o limite..."}`
   - Se a chamada nem aparece, o problema é no React; se aparece com erro,
     o problema é na API ou no banco.
4. Aba **Application → Local Storage**: o login fica em `mana_token`.
   Para simular "sessão limpa", apague essas chaves e recarregue.
5. **Testando no celular** (câmera do scanner): conecte o celular na mesma
   rede Wi-Fi, rode `npm run dev -- --host` e acesse o IP mostrado.
   ⚠️ A câmera só funciona em `localhost` ou **HTTPS** — no servidor de
   produção o HTTPS já resolve isso.

### 1.2 Debug da API (PHP)

1. **Teste a API isoladamente**, sem o React, usando o terminal:

   ```bash
   # Está viva? (deve responder JSON de erro de sessão — isso é BOM)
   curl https://www.admoema.com.br/biblioteca_digital/api/categorias

   # Login (deve devolver um token)
   curl -X POST https://www.admoema.com.br/biblioteca_digital/api/auth/login \
        -d '{"email":"admin@admoema.com.br","senha":"SUA_SENHA"}'

   # Rota autenticada (troque SEU_TOKEN pelo token recebido acima)
   curl https://www.admoema.com.br/biblioteca_digital/api/dashboard \
        -H "Authorization: Bearer SEU_TOKEN"
   ```

2. **Leia o log de erros do PHP.** Na HostGator, o arquivo `error_log`
   aparece dentro da pasta onde o erro ocorreu
   (ex.: `public_html/biblioteca_digital/api/error_log`). Ele mostra a linha
   exata do PHP que falhou.

3. **Debug temporário com log próprio:** em qualquer ponto da API você pode
   escrever `error_log('valor de $x: ' . json_encode($x));` e a mensagem
   aparecerá no `error_log`. Remova depois de resolver.

4. Localmente, rode a API com o servidor embutido e veja os erros na tela:

   ```bash
   php -S localhost:8000 -t api api/index.php
   ```

### 1.3 Debug do banco (MySQL)

1. Entre no **phpMyAdmin** (cPanel → Bancos de dados → phpMyAdmin).
2. Confira se as **16 tabelas** existem (`usuarios`, `livros`, `exemplares`,
   `emprestimos`, `reservas`, `avaliacoes`, `trilhas`…).
3. Use a aba **SQL** para investigar dados:

   ```sql
   -- Quem está com empréstimo atrasado?
   SELECT u.nome, l.titulo, e.data_prevista
   FROM emprestimos e
   JOIN exemplares x ON x.id = e.exemplar_id
   JOIN livros l ON l.id = x.livro_id
   JOIN usuarios u ON u.id = e.usuario_id
   WHERE e.status = 'atrasado';

   -- A auditoria registra tudo — ótimo para reconstituir um problema:
   SELECT * FROM auditoria ORDER BY criado_em DESC LIMIT 30;
   ```

4. Erro `500` com `"detalhe"` mencionando SQL = problema de banco
   (tabela faltando, coluna errada, banco fora do ar). O campo `detalhe`
   da resposta JSON mostra a mensagem exata do MySQL.

### 1.4 Checklist rápido de diagnóstico

| Sintoma | Provável camada | Primeiro passo |
|---|---|---|
| Tela branca | React | F12 → Console |
| "Resposta inválida do servidor" | API | `curl` na rota + `error_log` |
| Erro 500 com detalhe SQL | Banco | phpMyAdmin + `detalhe` do JSON |
| Login não funciona | API/Banco | conferir `config.php` e tabela `usuarios` |
| Câmera não abre | Navegador | precisa de HTTPS + permissão de câmera |
| Foto não lê o código | Iluminação | aproximar, focar, ou digitar o ISBN |

---

## Parte 2 — Publicar na HostGator

Objetivo: sistema no ar em **`https://www.admoema.com.br/biblioteca_digital`**.

### Passo 1 — Criar o banco de dados no cPanel

1. Acesse o cPanel da HostGator (`admoema.com.br/cpanel`).
2. Abra **"Bancos de Dados MySQL®"**.
3. Crie o banco: ex. `admoema_mana` (o cPanel adiciona o prefixo da conta).
4. Crie um usuário: ex. `admoema_manauser` com uma senha forte (anote!).
5. Em "Adicionar usuário ao banco", vincule o usuário ao banco com
   **TODOS OS PRIVILÉGIOS**.

### Passo 2 — Importar as tabelas

1. Abra o **phpMyAdmin** e clique no banco criado (`admoema_mana`).
2. Aba **Importar** → escolha o arquivo `database/schema.sql` deste projeto.
3. ⚠️ **Antes de importar**, abra o `schema.sql` num editor e **remova as 2
   linhas** `CREATE DATABASE...;` e `USE mana_biblioteca;` (na HostGator o
   banco já existe e tem outro nome).
4. Clique em **Executar**. Devem aparecer 16 tabelas.

### Passo 3 — Build do frontend (já vem pronto!)

A pasta **`frontend/dist/`** já está no repositório com o site compilado
(HTML, CSS, JS e o `.htaccess` das rotas incluídos). **Você não precisa de
terminal nem de npm** — basta usar essa pasta no próximo passo.

<details>
<summary>Só se um dia você alterar o código do frontend…</summary>

```bash
cd frontend
npm install
npm run build
```

Isso regenera a `frontend/dist/`, que deve ser reenviada ao servidor.
</details>

> O sistema já está configurado para o endereço `/biblioteca_digital/`
> (veja `base` em `frontend/vite.config.js`). Se um dia mudar a pasta,
> ajuste ali e gere o build de novo.

### Passo 4 — Enviar os arquivos

Use o **Gerenciador de Arquivos** do cPanel (ou FTP/FileZilla):

1. Em `public_html/`, crie a pasta **`biblioteca_digital`**.
2. Envie **o conteúdo** de `frontend/dist/` para dentro dela
   (`index.html`, pasta `assets/`, `.htaccess`).
   💡 Dica: compacte o conteúdo em `.zip`, envie e use "Extrair" no cPanel.
   ⚠️ Ative "Mostrar arquivos ocultos" nas configurações do Gerenciador
   para conferir que o `.htaccess` foi junto.
3. Envie a pasta **`api/`** completa do projeto para dentro de
   `biblioteca_digital/` (ficará `public_html/biblioteca_digital/api/`).

Estrutura final no servidor:

```
public_html/
└── biblioteca_digital/
    ├── index.html          ← do build
    ├── assets/             ← do build
    ├── .htaccess           ← do build (rotas do React + HTTPS)
    └── api/
        ├── index.php
        ├── .htaccess
        ├── config.php      ← você criará no próximo passo
        ├── src/
        └── routes/
```

### Passo 5 — Configurar a API

1. No Gerenciador de Arquivos, dentro de `biblioteca_digital/api/`,
   copie `config.example.php` para **`config.php`** e edite:

```php
return [
    'db_host' => 'localhost',
    'db_name' => 'admoema_mana',        // nome criado no Passo 1
    'db_user' => 'admoema_manauser',    // usuário criado no Passo 1
    'db_pass' => 'A_SENHA_DO_BANCO',
    'jwt_secret' => 'escreva-aqui-uma-frase-longa-unica-e-aleatoria',
    'jwt_dias' => 7,
    'cors_origens' => [],               // vazio em produção
];
```

2. Confira a **versão do PHP**: cPanel → "Select PHP Version" → escolha
   **PHP 8.1 ou superior** e garanta as extensões `pdo_mysql` e `mbstring`
   marcadas (normalmente já vêm).

### Passo 6 — Testar

1. Abra `https://www.admoema.com.br/biblioteca_digital/api/categorias`
   → deve responder `{"erro":"Sessão inválida..."}` ✅ (API no ar)
2. Abra `https://www.admoema.com.br/biblioteca_digital/`
   → deve aparecer a tela de login do MANÁ ✅
3. Entre com `admin@admoema.com.br` / `mana@2026`.
4. **TROQUE A SENHA IMEDIATAMENTE** e apague/edite este usuário-semente.
5. Teste no celular: catálogo, reserva e o scanner de câmera no
   cadastro de livros (o HTTPS da HostGator já habilita a câmera).

### Passo 7 — Atualizações futuras

- **Mudou o frontend?** Gere o build de novo (`npm run build`) ou peça para
  gerá-lo, e reenvie o conteúdo de `dist/` (não precisa mexer em `api/`
  nem no banco).
- **Mudou a API?** Reenvie só os arquivos alterados de `api/`
  (nunca sobrescreva o `config.php` do servidor).
- **Mudou o banco?** Rode o SQL da alteração no phpMyAdmin.
- 💾 **Backup**: o cPanel → "Backup" permite baixar o banco e os arquivos.
  Faça isso antes de qualquer atualização grande.

---

## Parte 3 — Problemas comuns no servidor

| Problema | Causa | Solução |
|---|---|---|
| Página inicial abre, mas F5 numa rota interna dá **404** | `.htaccess` do build não subiu | Reenvie o `.htaccess` para `biblioteca_digital/` (arquivo oculto!) |
| **500 Internal Server Error** em tudo | `.htaccess` incompatível ou PHP antigo | Confira "Select PHP Version" ≥ 8.1; veja `error_log` |
| API responde `config.php não encontrado` | Passo 5 não feito | Crie o `config.php` a partir do exemplo |
| API responde `Falha na conexão com o banco` | credenciais erradas | Revise `db_name`/`db_user`/`db_pass` (com o prefixo da conta!) e o vínculo usuário↔banco |
| Login sempre "sessão expirada" | cabeçalho Authorization não chega ao PHP | O `api/.htaccess` já trata isso; confira se ele subiu para o servidor |
| Acentos/emojis errados | importação sem utf8mb4 | Reimporte o `schema.sql` (ele contém `SET NAMES utf8mb4`) |
| Câmera não abre no celular | site sem HTTPS | Ative o SSL grátis da HostGator (cPanel → SSL/TLS Status) |
| Busca por ISBN não preenche | Nenhum dos 3 catálogos tem o título, ou o Google Books atingiu a cota diária do IP do servidor | Tente a busca por título/autor; para livros nacionais antigos sem registro, preencha manualmente. A cota do Google zera todo dia e as outras fontes continuam funcionando |
| Site lento no primeiro acesso | cache frio do PHP | Normal em hospedagem compartilhada; os acessos seguintes são rápidos |

---

## A consulta de livros "não encontra nada"? Leia isto

O cadastro consulta 6 fontes: **BrasilAPI/CBL** (registro oficial de ISBN do
Brasil), **Google Books**, **Mercado Editorial**, **OpenLibrary**,
**Mercado Livre** e **busca na web** (Amazon/Estante Virtual).

1. **Rode o diagnóstico:** entre como gerente/admin → menu **Sistema** →
   aba **🩺 Fontes de consulta** → "Testar fontes agora". Ele mostra qual
   fonte está funcionando a partir do servidor da HostGator.

2. **Google Books "respondeu vazio"?** É quase sempre a **cota diária por
   IP**: sem chave, o limite é dividido entre TODOS os sites hospedados no
   mesmo servidor. Solução definitiva (gratuita, ~5 minutos):
   - Acesse [console.cloud.google.com](https://console.cloud.google.com) com uma conta Google;
   - Crie um projeto (ex.: "biblioteca-mana");
   - Menu **APIs e serviços → Biblioteca** → procure **Books API** → **Ativar**;
   - Menu **APIs e serviços → Credenciais → Criar credenciais → Chave de API**;
   - Copie a chave e cole no `config.php` do servidor:
     `'google_books_key' => 'SUA_CHAVE_AQUI',`
   - Rode o diagnóstico de novo: deve aparecer "(com chave)" e funcionar.

3. **Livro brasileiro sem registro em nenhum catálogo?** Acontece com
   edições antigas ou de editoras pequenas. Use a busca por título/autor
   (que inclui Amazon/Mercado Livre) ou preencha manualmente — o número de
   tombo e todo o resto do sistema funcionam normalmente.

---

## Resumo de segurança em produção

- [x] Senhas com **bcrypt** e login com **JWT assinado** (HMAC-SHA256)
- [x] Todas as consultas SQL usam **prepared statements** (contra SQL injection)
- [x] `config.php` bloqueado por `.htaccess` e fora do Git
- [x] Controle de permissão **no servidor** em toda rota (o menu esconder não basta)
- [x] **Auditoria** de todas as ações administrativas
- [ ] Troque a senha do admin-semente após o primeiro login ← **sua tarefa!**
- [ ] Gere um `jwt_secret` próprio no `config.php` ← **sua tarefa!**
