// config/database.js
const { Pool } = require('pg');
const dotenv = require('dotenv');
// ... (dotenv.config() e checagem de DATABASE_URL como antes) ...
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error("ERRO FATAL: Variável de ambiente DATABASE_URL não definida.");
    process.exit(1);
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    // ssl: { rejectUnauthorized: false } // Ajustar conforme necessidade/docs do Neon
});

pool.query('SELECT NOW()', (err, res) => { /* ... (conexão como antes) ... */ });

// Função findUserByUsername permanece igual
async function findUserByUsername(username) {
    const query = {
        // Buscar também o 'role'
        text: 'SELECT id, username, "passwordHash", "role" FROM users WHERE username = $1',
        values: [username],
    };
    try {
        // ... (lógica e logs como antes) ...
        const result = await pool.query(query);
        // ... (retorno como antes) ...
        if (result.rows.length > 0) {
            console.log(`[DB] Usuário '${username}' encontrado com role: ${result.rows[0].role}.`);
            return result.rows[0];
        } else {
            console.log(`[DB] Usuário '${username}' não encontrado.`);
            return null;
        }
    } catch (error) {
        // ... (erro como antes) ...
        console.error(`[DB] Erro ao buscar usuário '${username}':`, error);
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
async function addUser({ username, passwordHash, role }) { // Adicionado 'role' opcional
    // Usar aspas duplas para nomes de coluna com maiúsculas ou reservados
    const query = {
        // Inclui 'role' na inserção se fornecido, senão o DB usa o DEFAULT 'user'
        // NOTA: Se 'role' for sempre fornecido, podemos simplificar o INSERT.
        // Esta versão é mais flexível.
        text: `INSERT INTO users (username, "passwordHash"${role ? ', "role"' : ''})
               VALUES ($1, $2${role ? ', $3' : ''})
                   RETURNING id, username, "createdAt", "role"`, // Retorna o 'role' também
        values: role ? [username, passwordHash, role] : [username, passwordHash],
    };
    try {
        console.log(`[DB] Inserindo novo usuário: ${username} ${role ? 'com role ' + role : 'com role padrão'}`);
        const result = await pool.query(query);
        const newUser = result.rows[0];
        console.log(`[DB] Usuário '${username}' inserido com sucesso com ID: ${newUser.id} e Role: ${newUser.role}`);
        return newUser; // Retorna o usuário recém-criado
    } catch (error) {
        // ... (tratamento de erro como antes, incluindo unique_violation '23505') ...
        console.error(`[DB] Erro ao inserir usuário '${username}':`, error);
        if (error.code === '23505') {
            throw new Error('Nome de usuário já existe.');
        }
        throw new Error('Erro ao inserir usuário no banco de dados.');
    }
}

module.exports = {
    findUserByUsername,
    addUser,
    // pool // Descomente se precisar
};