// config/database.js
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config(); // Carrega variáveis de ambiente do .env para uso local

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error("ERRO FATAL: Variável de ambiente DATABASE_URL não definida.");
    console.error("Certifique-se de que DATABASE_URL está no seu arquivo .env (local) ou nas variáveis de ambiente (produção).");
    process.exit(1); // Encerra a aplicação se a URL do DB não estiver configurada
}

// Configuração do Pool de Conexões
// Usar a DATABASE_URL diretamente é a forma mais comum com Neon/Render.
// Neon geralmente requer SSL. A connection string deles já inclui parâmetros para isso.
// Consulte a documentação do Neon para requisitos SSL específicos se encontrar problemas.
const pool = new Pool({
    connectionString: DATABASE_URL,
    // Neon recomenda usar a connection string que já inclui sslmode=require ou similar.
    // Se precisar de configuração explícita (menos comum com connection string completa):
    // ssl: {
    //   rejectUnauthorized: false // Use com cautela, verifique as recomendações de segurança do Neon/Render
    // }
});

// Opcional: Testar a conexão ao iniciar
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error("ERRO: Falha ao conectar ao banco de dados PostgreSQL (Neon).", err);
        // Considerar encerrar a aplicação se a conexão inicial falhar: process.exit(1);
    } else {
        console.log(`[DB] Conectado com sucesso ao PostgreSQL (Neon) em: ${res.rows[0].now}`);
    }
});


/**
 * Encontra um usuário pelo nome de usuário no banco de dados.
 * @param {string} username - O nome de usuário a ser procurado.
 * @returns {Promise<object|null>} O objeto do usuário (com id, username, passwordHash) ou null se não encontrado.
 */
async function findUserByUsername(username) {
    const query = {
        // Usar aspas duplas se o nome da coluna tiver letras maiúsculas ou for palavra reservada
        text: 'SELECT id, username, "passwordHash" FROM users WHERE username = $1',
        values: [username],
    };
    try {
        console.log(`[DB] Procurando usuário: ${username}`);
        const result = await pool.query(query);
        if (result.rows.length > 0) {
            console.log(`[DB] Usuário '${username}' encontrado.`);
            return result.rows[0]; // Retorna o primeiro usuário encontrado
        } else {
            console.log(`[DB] Usuário '${username}' não encontrado.`);
            return null; // Nenhum usuário encontrado
        }
    } catch (error) {
        console.error(`[DB] Erro ao buscar usuário '${username}':`, error);
        // Re-lançar o erro ou retornar null/lançar um erro específico da aplicação
        throw new Error('Erro ao consultar o banco de dados.');
    }
}

/**
 * Adiciona um novo usuário ao banco de dados.
 * @param {object} userData - Dados do usuário.
 * @param {string} userData.username - O nome de usuário.
 * @param {string} userData.passwordHash - O hash da senha.
 * @returns {Promise<object>} O objeto do novo usuário criado (com id, username, createdAt).
 */
async function addUser({ username, passwordHash }) {
    // Usar aspas duplas se o nome da coluna tiver letras maiúsculas ou for palavra reservada
    const query = {
        text: `INSERT INTO users (username, "passwordHash")
               VALUES ($1, $2)
               RETURNING id, username, "createdAt"`, // Retorna os dados inseridos
        values: [username, passwordHash],
    };
    try {
        console.log(`[DB] Inserindo novo usuário: ${username}`);
        const result = await pool.query(query);
        const newUser = result.rows[0];
        console.log(`[DB] Usuário '${username}' inserido com sucesso com ID: ${newUser.id}`);
        return newUser; // Retorna o usuário recém-criado
    } catch (error) {
        console.error(`[DB] Erro ao inserir usuário '${username}':`, error);
        // Verificar erro de constraint UNIQUE (usuário já existe) - Código de erro do Postgres para unique_violation é '23505'
        if (error.code === '23505') {
            // Lançar um erro específico ou retornar um valor que indique o conflito
            throw new Error('Nome de usuário já existe.'); // O controller tratará isso
        }
        // Lançar outros erros
        throw new Error('Erro ao inserir usuário no banco de dados.');
    }
}

module.exports = {
    findUserByUsername,
    addUser,
    // Você pode exportar o 'pool' se precisar fazer queries mais complexas em outros lugares,
    // ou adicionar mais funções aqui (ex: findUserById, updateUser, etc.)
    // pool // Descomente se precisar acessar o pool diretamente
};