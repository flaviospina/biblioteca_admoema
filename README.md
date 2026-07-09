# 🍞 MANÁ — Biblioteca Digital

**Assembleia de Deus · Ministério Belém · Setor 124 — Moema**

> *"Eu sou o pão vivo que desceu do céu." — João 6:51*

**Por que MANÁ?** Belém, em hebraico *Beit Lechem*, significa **"Casa do Pão"**.
O maná era o alimento diário que Deus dava ao Seu povo — e esta biblioteca é a
estante da Casa do Pão: o lugar onde a igreja busca, todos os dias, alimento
para a alma. O controle é 100% digital, mas **todos os empréstimos são de
livros físicos**, retirados e devolvidos na biblioteca da igreja.

---

## ✨ Funcionalidades

### Para os membros (leitores)
- **Catálogo online** com busca por título, autor, ISBN e tema, filtro por categoria e por disponibilidade
- **Reservas com fila de espera** — o sistema notifica quando o livro fica disponível e controla o prazo de retirada
- **Minha Estante**: empréstimos ativos (com renovação em 1 clique), reservas e **histórico completo de leitura**
- **Avaliações com estrelas e comentários** em cada livro
- **Sugestões de aquisição** — o membro indica títulos e acompanha o status (análise → aprovada → no acervo)
- **Central de notificações** dentro do sistema

### 🛤️ Diferencial: Trilhas de Leitura (jornadas de discipulado)
Pesquisamos os sistemas de biblioteca mais usados (Koha, Biblivre, PHL) — todos
cobrem catálogo, empréstimo e reserva, mas **nenhum conecta a leitura ao
discipulado**. No MANÁ, a liderança monta *trilhas* (ex.: "Fundamentos da Fé",
"Escola de Líderes"), o membro se inscreve e o progresso avança
automaticamente a cada devolução. Completou a trilha? **Conquista
desbloqueada** 🏅 — junto com selos por 5/10/20 livros lidos e devoluções sem
atraso. Leitura vira jornada, não obrigação.

### Para a equipe (bibliotecário, gerente, admin)
- **Cadastro de livro em segundos**: digite qualquer ISBN **ou aponte a câmera
  do celular / tire uma foto do código de barras** → o sistema lê o código,
  **consulta a internet (Google Books + OpenLibrary), preenche o formulário
  automaticamente e envia sozinho** (com contagem regressiva para revisar)
- **Controle de exemplares físicos** com número de tombo automático (MN-00000-00), estado de conservação, origem (compra/doação) e localização na estante
- **Circulação de balcão**: empréstimo por código de tombo ou busca, devolução, renovação, regras configuráveis (prazo, limite simultâneo, bloqueio por atraso, prioridade da fila de reserva)
- **Dashboard de indicadores**: totais, empréstimos por mês e por categoria, livros mais emprestados, leitores mais assíduos, devoluções da semana e atrasos
- **Cobrança via WhatsApp em 1 clique** — mensagem pronta e respeitosa para lembretes e atrasos
- **Gestão de usuários** com 4 níveis de acesso
- **Auditoria completa** — toda ação administrativa fica registrada
- **Parâmetros configuráveis** sem mexer em código (prazos, limites, renovações)

## 🔐 Níveis de acesso

| Nível | Pode fazer |
|---|---|
| **Usuário (leitor)** | catálogo, reservas, renovações próprias, avaliações, trilhas, sugestões |
| **Bibliotecário** | tudo acima + cadastrar livros/exemplares, circulação, dashboard, ver usuários |
| **Gerente** | tudo acima + excluir livros, criar usuários/bibliotecários, trilhas, moderar sugestões, auditoria |
| **Admin** | tudo acima + criar gerentes/admins, configurações do sistema |

## 🧱 Tecnologia

| Camada | Stack | Por quê |
|---|---|---|
| Frontend | **React 18 + Vite** | bibliotecas prontas para câmera/código de barras (`@zxing/browser`), SPA rápida |
| Backend | **PHP 8 (API REST)** | roda nativamente na hospedagem HostGator, sem servidor extra |
| Banco | **MySQL / MariaDB** | disponível no cPanel da HostGator |
| Autenticação | JWT (HMAC-SHA256) com senhas bcrypt | sem dependências externas |

## 📁 Estrutura

```
biblioteca_admoema/
├── database/schema.sql    ← tabelas MySQL + dados iniciais (importar no phpMyAdmin)
├── api/                   ← API PHP (sobe para a HostGator)
│   ├── index.php          ← roteador
│   ├── .htaccess          ← URLs amigáveis + segurança
│   ├── config.example.php ← copiar para config.php e preencher
│   ├── src/helpers.php    ← núcleo (PDO, JWT, papéis, auditoria)
│   └── routes/            ← um arquivo por recurso
├── frontend/              ← aplicativo React (gera o build que vai para o servidor)
│   └── src/
│       ├── paginas/       ← telas do leitor
│       └── paginas/admin/ ← telas administrativas
└── docs/DEBUG_E_DEPLOY_HOSTGATOR.md  ← como depurar e publicar
```

## 🚀 Rodando localmente

```bash
# 1. Banco (MySQL/MariaDB local)
mysql -u root < database/schema.sql

# 2. API
cp api/config.example.php api/config.php   # e preencha os dados
php -S localhost:8000 -t api api/index.php

# 3. Frontend
cd frontend
npm install
npm run dev        # abre http://localhost:5173/biblioteca_digital/
```

**Login inicial:** `admin@admoema.com.br` / senha `mana@2026` — **troque no primeiro acesso!**

## 📦 Publicando na HostGator

Guia passo a passo completo (incluindo como depurar problemas):
**[docs/DEBUG_E_DEPLOY_HOSTGATOR.md](docs/DEBUG_E_DEPLOY_HOSTGATOR.md)**
