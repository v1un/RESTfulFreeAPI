// controllers/authController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/database'); // Nosso mock de DB
const dotenv = require('dotenv');

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const BCRYPT_SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10');

if (!JWT_SECRET) {
    console.error("ERRO FATAL: Variável de ambiente JWT_SECRET não definida.");
    process.exit(1);
}

/**
 * Registra um novo usuário.
 */
const registerUser = async (req, res) => {
    const { username, password } = req.body;

    // Validação básica de entrada
    if (!username || !password) {
        return res.status(400).json({ message: 'Nome de usuário e senha são obrigatórios.' });
    }

    if (password.length < 6) {
        // Exemplo de validação de senha - Adicionar mais regras conforme necessário
        return res.status(400).json({ message: 'A senha deve ter pelo menos 6 caracteres.' });
    }

    try {
        console.log(`[Register] Tentativa de registro para usuário: ${username}`);
        // Verifica se o usuário já existe (usando nosso mock de DB)
        const existingUser = await db.findUserByUsername(username);
        if (existingUser) {
            console.warn(`[Register] Usuário '${username}' já existe.`);
            return res.status(409).json({ message: 'Nome de usuário já está em uso.' }); // 409 Conflict
        }

        // Gera o hash da senha
        console.log(`[Register] Gerando hash para senha do usuário: ${username}`);
        const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
        console.log(`[Register] Hash gerado com sucesso.`);

        // Salva o novo usuário (usando nosso mock de DB)
        const newUser = await db.addUser({ username, passwordHash });

        console.log(`[Register] Usuário '${username}' registrado com sucesso com ID: ${newUser.id}`);
        // Retorna uma resposta de sucesso (sem informações sensíveis)
        res.status(201).json({ // 201 Created
            message: 'Usuário registrado com sucesso!',
            userId: newUser.id,
            username: newUser.username
        });

    } catch (error) {
        console.error(`[Register] Erro ao registrar usuário '${username}':`, error);
        res.status(500).json({ message: 'Erro interno no servidor ao tentar registrar o usuário.' });
    }
};

/**
 * Autentica um usuário e retorna um token JWT.
 */
const loginUser = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Nome de usuário e senha são obrigatórios.' });
    }

    try {
        console.log(`[Login] Tentativa de login para usuário: ${username}`);
        // Busca o usuário no DB (mock)
        const user = await db.findUserByUsername(username);

        // Verifica se o usuário existe E se a senha está correta
        if (user && await bcrypt.compare(password, user.passwordHash)) {
            console.log(`[Login] Senha verificada com sucesso para: ${username}`);
            // Senha correta! Gerar o token JWT.
            const payload = {
                id: user.id,       // ID do usuário
                username: user.username,
                // Pode adicionar outros dados úteis, como papéis (roles)
                // roles: ['user'] // Exemplo
            };

            const token = jwt.sign(
                payload,
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );

            console.log(`[Login] Token JWT gerado para: ${username}`);
            // Envia o token para o cliente
            res.status(200).json({
                message: 'Login bem-sucedido!',
                accessToken: token
                // Pode-se incluir aqui informações do usuário (não sensíveis) ou configurações
                // user: { id: user.id, username: user.username }
            });

        } else {
            console.warn(`[Login] Falha no login para usuário: ${username}. Usuário não encontrado ou senha inválida.`);
            // Usuário não encontrado ou senha incorreta
            res.status(401).json({ message: 'Credenciais inválidas.' }); // 401 Unauthorized
        }
    } catch (error) {
        console.error(`[Login] Erro ao logar usuário '${username}':`, error);
        res.status(500).json({ message: 'Erro interno no servidor durante o login.' });
    }
};

module.exports = {
    registerUser,
    loginUser
};