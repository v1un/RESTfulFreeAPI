// config/database.js
const { Pool } = require('pg');

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
               RETURNING id, username, "createdAt", "role"`,
        values: [username, passwordHash, role || 'user'],
    };
    try {
        console.log(`[DB] Tentando inserir usuário: ${username} (Role: ${role || 'user'})`);
        const result = await pool.query(query);
        const newUser = result.rows[0];
        console.log(`[DB] Usuário '${username}' inserido com sucesso (ID: ${newUser.id}, Role: ${newUser.role}).`);
        return newUser;
    } catch (error) {
        if (error.code === '23505') {
            console.warn(`[DB] Falha ao inserir: Usuário '${username}' já existe.`);
            throw new Error('Nome de usuário já existe.');
        }
        console.error(`[DB] Erro ao inserir usuário '${username}'.`, error);
        throw new Error('Erro ao inserir usuário no banco de dados.');
    }
}

/**
 * Busca todos os usuários registrados (sem o hash da senha).
 * @returns {Promise<Array<object>>} Um array com os usuários.
 */
async function findAllUsers() {
    // Seleciona apenas os campos seguros/necessários
    const query = {
        text: 'SELECT id, username, "role", "createdAt" FROM users ORDER BY id ASC',
    };
    try {
        const result = await pool.query(query);
        console.log(`[DB] Buscados ${result.rows.length} usuários.`);
        return result.rows;
    } catch (error) {
        console.error('[DB] Erro ao buscar todos os usuários.', error);
        throw new Error('Erro ao consultar usuários.');
    }
}


// --- Funções de Código de Convite (Invite Code Functions) ---

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
        if (error.code === '23505') {
            console.warn(`[DB] Tentativa de inserir código de convite duplicado: ${code}`);
            throw new Error('Código de convite duplicado.');
        }
        console.error(`[DB] Erro ao adicionar código de convite '${code}'.`, error);
        throw new Error('Erro ao salvar código de convite.');
    }
}

async function findInviteCode(code) {
    const query = {
        text: 'SELECT id, code, is_used, created_by, used_by, created_at, used_at FROM invite_codes WHERE code = $1',
        values: [code]
    };
    try {
        const result = await pool.query(query);
        // Não loga aqui para não poluir - logará no controller se necessário
        return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
        console.error(`[DB] Erro ao buscar código de convite '${code}'.`, error);
        throw new Error('Erro ao consultar código de convite.');
    }
}

async function markInviteCodeAsUsed(code, userId) {
    const query = {
        text: `UPDATE invite_codes
               SET is_used = true, used_by = $1, used_at = CURRENT_TIMESTAMP
               WHERE code = $2 AND is_used = false
               RETURNING id`,
        values: [userId, code]
    };
    try {
        const result = await pool.query(query);
        if (result.rowCount === 1) {
            console.log(`[DB] Código de convite '${code}' marcado como usado pelo User ID: ${userId}.`);
            return true;
        }
        console.warn(`[DB] Código de convite '${code}' não encontrado ou já estava usado ao tentar marcar.`);
        return false;
    } catch (error) {
        console.error(`[DB] Erro ao marcar código de convite '${code}' como usado.`, error);
        throw new Error('Erro ao atualizar código de convite.');
    }
}

/**
 * Busca todos os códigos de convite registrados.
 * TODO: Considerar paginação para muitos códigos.
 * TODO: Considerar JOIN para buscar username do criador/usuário.
 * @returns {Promise<Array<object>>} Um array com os códigos de convite.
 */
async function findAllInviteCodes() {
    const query = {
        text: `SELECT id, code, is_used, created_by, used_by, created_at, used_at
               FROM invite_codes
               ORDER BY created_at DESC`, // Ordena pelos mais recentes primeiro
    };
    try {
        const result = await pool.query(query);
        console.log(`[DB] Buscados ${result.rows.length} códigos de convite.`);
        return result.rows;
    } catch (error) {
        console.error('[DB] Erro ao buscar todos os códigos de convite.', error);
        throw new Error('Erro ao consultar códigos de convite.');
    }
}

module.exports = {
    // User functions
    findUserByUsername,
    addUser,
    findAllUsers, // <-- Exporta nova função
    // Invite code functions
    addInviteCode,
    findInviteCode,
    markInviteCodeAsUsed,
    findAllInviteCodes, // <-- Exporta nova função
};