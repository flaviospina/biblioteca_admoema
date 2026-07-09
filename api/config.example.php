<?php
/**
 * MANÁ — Biblioteca Digital | Configuração
 *
 * 1. Copie este arquivo para config.php
 * 2. Preencha com os dados do MySQL criado no cPanel da HostGator
 * 3. Gere um JWT_SECRET novo (qualquer texto longo e aleatório)
 */

return [
    // Banco de dados (cPanel > Bancos de Dados MySQL)
    'db_host' => 'localhost',
    'db_name' => 'usuario_mana_biblioteca',
    'db_user' => 'usuario_mana',
    'db_pass' => 'SENHA_DO_BANCO',

    // Segredo usado para assinar os tokens de login (troque!)
    'jwt_secret' => 'TROQUE-POR-UMA-FRASE-LONGA-E-ALEATORIA-9f8a7b6c',

    // Validade do login em dias
    'jwt_dias' => 7,

    // Origens permitidas para CORS (em produção, deixe vazio = mesma origem)
    // Em desenvolvimento local, use: ['http://localhost:5173']
    'cors_origens' => [],
];
