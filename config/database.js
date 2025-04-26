// config/database.js
const { Pool } = require('pg');

// dotenv.config() é chamado apenas em server.js

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
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
    } else {
        console.info(`[DB] Conexão com PostgreSQL estabelecida com sucesso.`);
    }
});


// --- Funções de Usuário (User Functions) ---

async function findUserByUsername(username) {
    const query = {
        text: 'SELECT id, username, "passwordHash", "role" FROM users WHERE username = $1',
        values: [username],
    };
    try {
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

async function addUser({ username, passwordHash, role }) {
    const query = {
        text: `INSERT INTO users (username, "passwordHash", "role")
               VALUES ($1, $2, $3)
                   RETURNING id, username, "createdAt", "role"`, // Role agora é obrigatório no INSERT
        values: [username, passwordHash, role || 'user'], // Garante que role 'user' seja o padrão se não especificado
    };
    try {
        console.log(`[DB] Tentando inserir usuário: ${username} (Role: ${role || 'user'})`);
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


// --- Funções de Código de Convite (Invite Code Functions) ---

/**
 * Adiciona um novo código de convite ao banco de dados.
 * @param {string} code - O código de convite gerado.
 * @param {number} adminUserId - O ID do usuário admin que gerou o código.
 * @returns {Promise<object>} O objeto do código de convite criado.
 */
async function addInviteCode(code, adminUserId) {
    const query = {
        text: `INSERT INTO invite_codes (code, created_by) VALUES ($1, $2)
               RETURNING id, code, created_at, created_by`,
        values: [code, adminUserId]
    };
    try {
        const result = await pool.query(query);
        console.log(`[DB] Código de convite '${code}' adicionado pelo Admin ID: ${adminUserId}.`);
        return result.rows[0];
    } catch (error) {
        // Tratar erro de código duplicado (embora raro com boa geração)
        if (error.code === '23505') {
            console.warn(`[DB] Tentativa de inserir código de convite duplicado: ${code}`);
            throw new Error('Código de convite duplicado.'); // Ou tentar gerar novo código
        }
        console.error(`[DB] Erro ao adicionar código de convite '${code}'.`, error);
        throw new Error('Erro ao salvar código de convite.');
    }
}

/**
 * Encontra um código de convite pelo próprio código.
 * @param {string} code - O código de convite a ser procurado.
 * @returns {Promise<object|null>} O objeto do código ou null se não encontrado.
 */
async function findInviteCode(code) {
    const query = {
        text: 'SELECT id, code, is_used, created_by, used_by, created_at, used_at FROM invite_codes WHERE code = $1',
        values: [code]
    };
    try {
        const result = await pool.query(query);
        if (result.rows.length > 0) {
            return result.rows[0];
        }
        return null;
    } catch (error) {
        console.error(`[DB] Erro ao buscar código de convite '${code}'.`, error);
        throw new Error('Erro ao consultar código de convite.');
    }
}

/**
 * Marca um código de convite como usado.
 * @param {string} code - O código a ser marcado como usado.
 * @param {number} userId - O ID do usuário que utilizou o código.
 * @returns {Promise<boolean>} True se o código foi marcado com sucesso, false caso contrário.
 */
async function markInviteCodeAsUsed(code, userId) {
    // Usamos WHERE is_used = false para garantir atomicidade simples (evita usar um código já usado em race condition)
    const query = {
        text: `UPDATE invite_codes
               SET is_used = true, used_by = $1, used_at = CURRENT_TIMESTAMP
               WHERE code = $2 AND is_used = false
               RETURNING id`, // Retorna id se a atualização funcionou
        values: [userId, code]
    };
    try {
        const result = await pool.query(query);
        // Se rowsAffected (ou RETURNING teve resultado) for 1, a atualização foi bem-sucedida
        if (result.rowCount === 1) {
            console.log(`[DB] Código de convite '${code}' marcado como usado pelo User ID: ${userId}.`);
            return true;
        }
        // Se rowCount for 0, o código não existia ou já estava usado
        console.warn(`[DB] Código de convite '${code}' não encontrado ou já estava usado ao tentar marcar.`);
        return false;
    } catch (error) {
        console.error(`[DB] Erro ao marcar código de convite '${code}' como usado.`, error);
        throw new Error('Erro ao atualizar código de convite.');
    }
}

module.exports = {
    // User functions
    findUserByUsername,
    addUser,
    // Invite code functions
    addInviteCode,
    findInviteCode,
    markInviteCodeAsUsed,
};