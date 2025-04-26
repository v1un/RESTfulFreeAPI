// config/database.js
const { Pool } = require('pg');

// dotenv.config() FOI REMOVIDO DAQUI - chamado apenas em server.js

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    // Este erro não deve mais acontecer se dotenv funcionar corretamente em server.js
    console.error("[DB] ERRO FATAL: Variável de ambiente DATABASE_URL não chegou a config/database.js.");
    console.error("[DB] Verifique se dotenv.config() está no topo de server.js e se a variável está definida.");
    process.exit(1);
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    // ssl: { rejectUnauthorized: false } // Ajustar conforme necessidade/docs do Neon
});

// Testar a conexão ao iniciar
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error("[DB] ERRO: Falha fatal ao conectar ao PostgreSQL.", err);
        // Considerar encerrar a aplicação se o DB for essencial: process.exit(1);
    } else {
        console.info(`[DB] Conexão com PostgreSQL estabelecida com sucesso.`);
    }
});


/**
 * Encontra um usuário pelo nome de usuário no banco de dados.
 * @param {string} username - O nome de usuário a ser procurado.
 * @returns {Promise<object|null>} O objeto do usuário (com id, username, passwordHash, role) ou null se não encontrado.
 */
async function findUserByUsername(username) {
    const query = {
        text: 'SELECT id, username, "passwordHash", "role" FROM users WHERE username = $1',
        values: [username],
    };
    try {
        // console.log(`[DB] Buscando usuário: ${username}`); // Log removido
        const result = await pool.query(query);
        if (result.rows.length > 0) {
            console.log(`[DB] Usuário '${username}' encontrado (Role: ${result.rows[0].role}).`);
            return result.rows[0];
        } else {
            return null;
        }
    } catch (error) {
        console.error(`[DB] Erro ao buscar usuário '${username}'.`, error);
        throw new Error('Erro ao consultar o banco de dados.');
    }
}

/**
 * Adiciona um novo usuário ao banco de dados.
 * Aceita opcionalmente um 'role'. Se não fornecido, usa o default do DB ('user').
 * @param {object} userData - Dados do usuário.
 * @param {string} userData.username - O nome de usuário.
 * @param {string} userData.passwordHash - O hash da senha.
 * @param {string} [userData.role] - O papel do usuário (opcional).
 * @returns {Promise<object>} O objeto do novo usuário criado (com id, username, createdAt, role).
 */
async function addUser({ username, passwordHash, role }) {
    const query = {
        text: `INSERT INTO users (username, "passwordHash"${role ? ', "role"' : ''})
               VALUES ($1, $2${role ? ', $3' : ''})
               RETURNING id, username, "createdAt", "role"`,
        values: role ? [username, passwordHash, role] : [username, passwordHash],
    };
    try {
        console.log(`[DB] Tentando inserir usuário: ${username} (Role: ${role || 'default'})`);
        const result = await pool.query(query);
        const newUser = result.rows[0];
        console.log(`[DB] Usuário '${username}' inserido com sucesso (ID: ${newUser.id}, Role: ${newUser.role}).`);
        return newUser;
    } catch (error) {
        if (error.code === '23505') { // Código de erro do Postgres para unique_violation
            console.warn(`[DB] Falha ao inserir: Usuário '${username}' já existe.`);
            throw new Error('Nome de usuário já existe.');
        }
        console.error(`[DB] Erro ao inserir usuário '${username}'.`, error);
        throw new Error('Erro ao inserir usuário no banco de dados.');
    }
}

module.exports = {
    findUserByUsername,
    addUser,
    // pool // Descomente se precisar acessar o pool diretamente em outros lugares
};