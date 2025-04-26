// controllers/authController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid'); // Para gerar IDs únicos para JWT (jti)
const db = require('../config/database');
const { addToBlacklist } = require('../config/tokenBlacklist');
const dotenv = require('dotenv');


const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const BCRYPT_SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10');

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
    console.error("ERRO FATAL: Segredos JWT não definidos.");
    process.exit(1);
}

/**
 * Gera um Access Token.
 */
function generateAccessToken(user) {
    const payload = {
        id: user.id,
        username: user.username,
        role: user.role, // Inclui o role no payload
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Gera um Refresh Token.
 * Inclui um JWT ID (jti) para permitir a invalidação/blacklist.
 */
function generateRefreshToken(user) {
    const payload = {
        id: user.id, // Pode incluir menos dados se preferir
        role: user.role,
    };
    // Usamos um JTI (JWT ID) único para poder adicionar este token específico à blacklist no logout
    const options = {
        expiresIn: JWT_REFRESH_EXPIRES_IN,
        jwtid: uuidv4() // Gera um ID único para este refresh token
    };
    return jwt.sign(payload, JWT_REFRESH_SECRET, options);
}


/**
 * Registra um novo usuário.
 */
const registerUser = async (req, res) => {
    // A validação agora é feita pelo middleware handleValidationErrors

    const { username, password, role } = req.body; // Pode receber 'role' opcionalmente

    try {
        console.log(`[Register] Tentativa de registro para usuário: ${username}`);

        // Verifica se o usuário já existe (DB já trata unique constraint, mas podemos verificar antes)
        // const existingUser = await db.findUserByUsername(username);
        // if (existingUser) { ... } // O catch do addUser já trata o erro '23505'

        console.log(`[Register] Gerando hash para senha do usuário: ${username}`);
        const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
        console.log(`[Register] Hash gerado com sucesso.`);

        // Salva o novo usuário (passando role se existir)
        const newUser = await db.addUser({ username, passwordHash, role }); // Passa role

        console.log(`[Register] Usuário '${username}' registrado com sucesso com ID: ${newUser.id} e Role: ${newUser.role}`);
        res.status(201).json({
            message: 'Usuário registrado com sucesso!',
            userId: newUser.id,
            username: newUser.username,
            role: newUser.role
        });

    } catch (error) {
        console.error(`[Register] Erro ao registrar usuário '${username}':`, error);
        // Se o erro for de usuário já existente vindo do DB
        if (error.message === 'Nome de usuário já existe.') {
            return res.status(409).json({ message: 'Nome de usuário já está em uso.' });
        }
        res.status(500).json({ message: 'Erro interno no servidor ao tentar registrar o usuário.' });
    }
};

/**
 * Autentica um usuário e retorna Access e Refresh Tokens.
 */
const loginUser = async (req, res) => {
    // A validação agora é feita pelo middleware handleValidationErrors

    const { username, password } = req.body;

    try {
        console.log(`[Login] Tentativa de login para usuário: ${username}`);
        const user = await db.findUserByUsername(username);

        if (user && await bcrypt.compare(password, user.passwordHash)) {
            console.log(`[Login] Senha verificada com sucesso para: ${username}`);

            // Gerar ambos os tokens
            const accessToken = generateAccessToken(user);
            const refreshToken = generateRefreshToken(user); // Gera refresh token com JTI

            console.log(`[Login] Tokens gerados para: ${username}`);

            // Enviar ambos os tokens para o cliente
            // O Refresh Token pode ser enviado em um cookie HttpOnly seguro em produção
            res.status(200).json({
                message: 'Login bem-sucedido!',
                accessToken: accessToken,
                refreshToken: refreshToken, // Inclui o refresh token na resposta
                user: { // Inclui informações do usuário (não sensíveis)
                    id: user.id,
                    username: user.username,
                    role: user.role
                }
            });

        } else {
            console.warn(`[Login] Falha no login para usuário: ${username}. Credenciais inválidas.`);
            res.status(401).json({ message: 'Credenciais inválidas.' });
        }
    } catch (error) {
        console.error(`[Login] Erro ao logar usuário '${username}':`, error);
        res.status(500).json({ message: 'Erro interno no servidor durante o login.' });
    }
};


/**
 * Gera um novo Access Token usando um Refresh Token válido.
 */
const refreshToken = async (req, res) => {
    // O token é verificado pelo middleware verifyRefreshToken, incluindo a blacklist
    // Se chegou aqui, o refresh token é válido e não está na blacklist

    const userId = req.user.id; // Obtém id do payload do refresh token verificado

    // Idealmente, buscaríamos o usuário no DB para garantir que ainda existe e pegar dados atualizados
    // const user = await db.findUserById(userId); // Precisaria criar essa função em database.js
    // if (!user) return res.status(401).json({ message: "Usuário não encontrado." });

    // Para simplificar, usamos os dados do payload do refresh token (pode estar desatualizado se o role mudar)
    const userPayload = {
        id: req.user.id,
        username: req.user.username, // Precisa garantir que username está no payload do refresh token
        role: req.user.role
    };

    // Gerar apenas um novo Access Token
    const newAccessToken = generateAccessToken(userPayload);

    console.log(`[Refresh] Novo Access Token gerado para usuário ID: ${userId}`);
    res.status(200).json({
        accessToken: newAccessToken
    });
};


/**
 * Invalida o Refresh Token adicionando seu JTI à blacklist.
 */
const logoutUser = async (req, res) => {
    const { refreshToken } = req.body; // Espera o refresh token no corpo

    if (!refreshToken) {
        return res.status(400).json({ message: 'Refresh token é obrigatório para logout.' });
    }

    try {
        // Verificar o refresh token apenas para obter o JTI de forma segura
        // Usamos o mesmo segredo de refresh
        jwt.verify(refreshToken, JWT_REFRESH_SECRET, (err, decoded) => {
            if (err) {
                // Token inválido ou expirado, não pode ser adicionado à blacklist de forma confiável
                // Mas o logout efetivamente ocorreu do ponto de vista do cliente que perdeu o token
                console.warn(`[Logout] Tentativa de logout com token inválido/expirado: ${err.message}`);
                // Retornar sucesso mesmo assim, pois o objetivo é deslogar
                return res.status(200).json({ message: 'Logout realizado (token já inválido/expirado).' });
            }

            // Se o token for válido e tiver um JTI, adiciona à blacklist
            const jti = decoded.jti;
            if (jti) {
                addToBlacklist(jti); // Adiciona o ID do token à blacklist
                console.log(`[Logout] Refresh Token (JTI: ${jti}) adicionado à blacklist para usuário ID: ${decoded.id}.`);
                res.status(200).json({ message: 'Logout bem-sucedido!' });
            } else {
                // Token válido mas sem JTI (não deveria acontecer com nossa geração de token)
                console.warn('[Logout] Refresh token válido, mas sem JTI para adicionar à blacklist.');
                res.status(400).json({ message: 'Não foi possível invalidar o token.' });
            }
        });

    } catch (error) {
        // Captura erros inesperados durante a verificação (embora jwt.verify use callback)
        console.error('[Logout] Erro inesperado durante o logout:', error);
        res.status(500).json({ message: 'Erro interno no servidor durante o logout.' });
    }
};


// Exemplo: Buscar dados do perfil do usuário logado
const getUserProfile = async (req, res) => {
    // O usuário é autenticado pelo middleware verifyAccessToken
    // Os dados do usuário (id, username, role) estão em req.user
    const userId = req.user.id;

    // Em uma aplicação real, você poderia buscar mais dados do DB aqui
    // const userProfile = await db.findUserById(userId); // Exemplo

    console.log(`[Profile] Acessando perfil do usuário ID: ${userId}`);

    // Retorna os dados disponíveis no token (ou buscados no DB)
    res.status(200).json({
        message: "Dados do perfil obtidos com sucesso.",
        user: {
            id: req.user.id,
            username: req.user.username,
            role: req.user.role
            // ... outros dados do perfil se buscados no DB
        }
    });
};


module.exports = {
    registerUser,
    loginUser,
    refreshToken,
    logoutUser,
    getUserProfile // Exporta a nova função de perfil
};