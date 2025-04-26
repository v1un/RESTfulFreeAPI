// seedAdmin.js
// Script para criar um usuário administrador inicial de forma segura.

const bcrypt = require('bcrypt');
const { Pool } = require('pg'); // Importa Pool diretamente
const dotenv = require('dotenv');
const path = require('path');

// Carrega variáveis do .env para o script
const envPath = path.resolve(__dirname, '.env');
dotenv.config({ path: envPath });

// --- Configuração ---
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin'; // Default 'admin'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD; // Senha DEVE vir do .env
const ADMIN_ROLE = 'admin'; // Papel a ser atribuído
const BCRYPT_SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10');
const DATABASE_URL = process.env.DATABASE_URL;

// --- Validações ---
if (!ADMIN_PASSWORD) {
    console.error('ERRO: Senha do administrador (ADMIN_PASSWORD) não definida no arquivo .env.');
    process.exit(1);
}
if (!DATABASE_URL) {
    console.error('ERRO: URL do banco de dados (DATABASE_URL) não definida no arquivo .env.');
    process.exit(1);
}

// --- Lógica Principal ---
const pool = new Pool({ connectionString: DATABASE_URL }); // Cria pool de conexão

async function createAdminUser() {
    console.log(`[SeedAdmin] Iniciando criação do usuário admin: ${ADMIN_USERNAME}`);
    let client; // Variável para o cliente do pool

    try {
        client = await pool.connect(); // Obtém um cliente do pool
        console.log('[SeedAdmin] Conectado ao banco de dados.');

        // 1. Verificar se o usuário admin já existe
        const checkUserQuery = {
            text: 'SELECT 1 FROM users WHERE username = $1',
            values: [ADMIN_USERNAME],
        };
        const checkResult = await client.query(checkUserQuery);

        if (checkResult.rows.length > 0) {
            console.warn(`[SeedAdmin] Usuário admin '${ADMIN_USERNAME}' já existe. Nenhuma ação necessária.`);
            return; // Sai se já existe
        }

        console.log(`[SeedAdmin] Usuário '${ADMIN_USERNAME}' não encontrado. Criando...`);

        // 2. Gerar hash da senha
        console.log('[SeedAdmin] Gerando hash da senha...');
        const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_SALT_ROUNDS);
        console.log('[SeedAdmin] Hash gerado.');

        // 3. Inserir o usuário admin
        const insertUserQuery = {
            text: `INSERT INTO users (username, "passwordHash", "role") VALUES ($1, $2, $3) RETURNING id`,
            values: [ADMIN_USERNAME, passwordHash, ADMIN_ROLE],
        };
        const insertResult = await client.query(insertUserQuery);
        const newAdminId = insertResult.rows[0].id;

        console.log(`✅ [SeedAdmin] Sucesso! Usuário admin '${ADMIN_USERNAME}' criado com ID: ${newAdminId} e Role: ${ADMIN_ROLE}.`);

    } catch (error) {
        console.error('[SeedAdmin] ERRO durante a criação do usuário admin:', error);
        process.exitCode = 1; // Indica erro na saída do script
    } finally {
        // 4. Liberar o cliente de volta para o pool, INDEPENDENTE de sucesso ou erro
        if (client) {
            client.release();
            console.log('[SeedAdmin] Conexão com o banco liberada.');
        }
        // 5. Encerrar o pool (importante para o script terminar)
        await pool.end();
        console.log('[SeedAdmin] Pool de conexões encerrado.');
    }
}

// Executa a função principal
createAdminUser();