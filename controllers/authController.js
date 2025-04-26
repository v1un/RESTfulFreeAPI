// controllers/authController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid'); // Para gerar IDs únicos para JWT (jti)
const db = require('../config/database');
const { addToBlacklist } = require('../config/tokenBlacklist');

// dotenv.config() FOI REMOVIDO DAQUI

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const BCRYPT_SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10');

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
    console.error("ERRO FATAL: Segredos JWT não definidos no controller.");
    process.exit(1);
}

// --- Funções Helper ---

/**
 * Gera um Access Token.
 */
function generateAccessToken(user) {
    const payload = {
        id: user.id,
        username: user.username,
        role: user.role, // Inclui o role no payload
    };
    // Não inclui JTI no access token, pois geralmente não são revogados individualmente
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Gera um Refresh Token.
 * Inclui um JWT ID (jti) para permitir a invalidação/blacklist.
 */
function generateRefreshToken(user) {
    const payload = {
        id: user.id, // Apenas ID e role são suficientes para gerar novo access token
        role: user.role,
    };
    const options = {
        expiresIn: JWT_REFRESH_EXPIRES_IN,
        jwtid: uuidv4() // Gera um ID único (JTI) para este refresh token
    };
    return jwt.sign(payload, JWT_REFRESH_SECRET, options);
}

// --- Controladores das Rotas ---

/**
 * Registra um novo usuário. SEMPRE com a role 'user'.
 */
const registerUser = async (req, res) => {
    // A validação de entrada (username, password) é feita pelos middlewares na rota

    // IGNORAMOS qualquer 'role' que possa vir do corpo da requisição por segurança
    const { username, password } = req.body;

    try {
        console.log(`[Register] Iniciando registro público para: ${username}`);

        // Gera o hash da senha
        const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

        // Salva o novo usuário no banco de dados, FORÇANDO a role 'user' (ou deixando o default do DB)
        // Não passamos o 'role' do req.body para db.addUser
        const newUser = await db.addUser({ username, passwordHash }); // Role usará o DEFAULT 'user' do DB

        console.log(`[Register] Sucesso: Usuário ${username} (ID: ${newUser.id}, Role: ${newUser.role}) criado via registro público.`);
        // Retorna resposta de sucesso
        res.status(201).json({
            message: 'Usuário registrado com sucesso!',
            userId: newUser.id,
            username: newUser.username,
            role: newUser.role // Será 'user'
        });

    } catch (error) {
        // Verifica se o erro é de usuário duplicado vindo do DB
        if (error.message === 'Nome de usuário já existe.') {
            // Log de aviso já acontece na camada do DB
            return res.status(409).json({ message: 'Nome de usuário já está em uso.' }); // 409 Conflict
        }
        // Loga outros erros fatais
        console.error(`[Register] ERRO FATAL ao registrar ${username}:`, error);
        res.status(500).json({ message: 'Erro interno no servidor ao registrar usuário.' });
    }
};

/**
 * Autentica um usuário e retorna Access e Refresh Tokens.
 */
const loginUser = async (req, res) => {
    // A validação de entrada é feita pelos middlewares na rota

    const { username, password } = req.body;

    try {
        console.log(`[Login] Tentativa de login para: ${username}`);
        // Busca o usuário no banco de dados
        const user = await db.findUserByUsername(username);

        // Verifica se o usuário existe e se a senha está correta
        if (user && await bcrypt.compare(password, user.passwordHash)) {

            // Gera ambos os tokens
            const accessToken = generateAccessToken(user);
            const refreshToken = generateRefreshToken(user); // Gera refresh token com JTI

            console.log(`[Login] Sucesso: Autenticado ${username} (ID: ${user.id}, Role: ${user.role}). Tokens gerados.`);

            // Envia ambos os tokens para o cliente
            // Em produção, considere enviar o refreshToken em um cookie HttpOnly e SameSite=Strict/Lax
            res.status(200).json({
                message: 'Login bem-sucedido!',
                accessToken: accessToken,
                refreshToken: refreshToken, // Inclui o refresh token na resposta
                user: { // Inclui informações básicas do usuário (não sensíveis)
                    id: user.id,
                    username: user.username,
                    role: user.role
                }
            });

        } else {
            // Usuário não encontrado ou senha incorreta
            console.warn(`[Login] Falha: Credenciais inválidas para ${username}.`);
            res.status(401).json({ message: 'Credenciais inválidas.' }); // 401 Unauthorized
        }
    } catch (error) {
        // Loga erros inesperados durante o login
        console.error(`[Login] ERRO FATAL ao logar ${username}:`, error);
        res.status(500).json({ message: 'Erro interno no servidor durante o login.' });
    }
};


/**
 * Gera um novo Access Token usando um Refresh Token válido.
 */
const refreshToken = async (req, res) => {
    // Validação do corpo da requisição (presença do refreshToken) feita por middleware na rota
    const { refreshToken } = req.body;

    try {
        // Verifica o refresh token (validade, assinatura E blacklist)
        jwt.verify(refreshToken, JWT_REFRESH_SECRET, async (err, decoded) => {
            if (err) {
                // Trata erros de verificação (expirado, inválido, etc.)
                let status = 403; let message = 'Refresh token inválido.';
                if (err.name === 'TokenExpiredError') { status = 401; message = 'Refresh token expirado.'; }
                console.warn(`[Refresh] Falha: ${message}`);
                return res.status(status).json({ message });
            }

            // Verifica se o token está na blacklist (JTI)
            const jti = decoded.jti;
            if (!jti || isBlacklisted(jti)) {
                // Log já acontece em isBlacklisted
                return res.status(401).json({ message: 'Refresh token inválido (revogado).' });
            }

            // Refresh token é válido e não está na blacklist. Gera novo Access Token.
            const userId = decoded.id;
            const userRole = decoded.role; // Usar dados do token (podem estar desatualizados)

            // Opcional: Buscar usuário no DB para garantir que existe e pegar dados frescos
            // const currentUser = await db.findUserById(userId); // Necessitaria findUserById
            // if (!currentUser) return res.status(401).json({ message: "Usuário não encontrado." });
            // const userPayload = { id: currentUser.id, username: currentUser.username, role: currentUser.role };

            // Usando dados do token por simplicidade:
            // Tentamos obter o username do DB se possível, mas pode não estar implementado findUserById
            let usernameFromDb = 'N/A';
            // if (currentUser) usernameFromDb = currentUser.username; // Se buscar no DB

            const userPayload = { id: userId, role: userRole, username: usernameFromDb };


            const newAccessToken = generateAccessToken(userPayload);

            console.log(`[Refresh] Sucesso: Novo Access Token gerado para User ID ${userId}.`);
            res.status(200).json({
                accessToken: newAccessToken
            });
        });
    } catch (error) {
        // Captura erros inesperados (ex: se a busca no DB falhar, caso implementada)
        console.error(`[Refresh] ERRO ao gerar novo token:`, error);
        res.status(500).json({ message: 'Erro ao processar a renovação do token.' });
    }
};


/**
 * Invalida o Refresh Token adicionando seu JTI à blacklist.
 */
const logoutUser = async (req, res) => {
    // Validação do corpo feita por middleware na rota
    const { refreshToken } = req.body;

    try {
        // Verifica o refresh token apenas para obter o JTI de forma segura
        jwt.verify(refreshToken, JWT_REFRESH_SECRET, { ignoreExpiration: true }, (err, decoded) => {
            // Ignoramos expiração aqui, pois queremos invalidar mesmo se expirado recentemente
            // Mas ainda falha se a assinatura for inválida
            if (err && err.name !== 'TokenExpiredError') {
                console.warn(`[Logout] Aviso: Tentativa de logout com token de refresh inválido (não expirado). Erro: ${err.message}`);
                // Ainda retorna sucesso, pois o objetivo do cliente é deslogar.
                return res.status(200).json({ message: 'Logout realizado (token inválido).' });
            }

            // Se decodificado (mesmo expirado), tenta pegar o JTI
            const jti = decoded?.jti;
            const userId = decoded?.id || 'N/A';

            if (jti) {
                addToBlacklist(jti); // Adiciona o ID do token à blacklist
                console.log(`[Logout] Sucesso: Refresh Token (JTI: ${jti}) invalidado para User ID ${userId}.`);
                res.status(200).json({ message: 'Logout bem-sucedido!' });
            } else {
                // Token válido/expirado mas sem JTI (não deveria acontecer com nossa geração de token)
                console.warn(`[Logout] Aviso: Token de refresh processado, mas sem JTI. Não foi possível adicionar à blacklist (User ID: ${userId}).`);
                // Retorna sucesso mesmo assim, pois o cliente não pode mais usar o token (se expirado)
                // ou não havia como invalidar (sem jti)
                res.status(200).json({ message: 'Logout processado.' });
            }
        });

    } catch (error) {
        // Captura erros inesperados durante a verificação (embora jwt.verify use callback)
        console.error('[Logout] ERRO INESPERADO durante o logout:', error);
        res.status(500).json({ message: 'Erro interno no servidor durante o logout.' });
    }
};


/**
 * Exemplo: Buscar dados do perfil do usuário logado.
 */
const getUserProfile = async (req, res) => {
    // O usuário é autenticado pelo middleware verifyAccessToken
    // Os dados do usuário (id, username, role) estão em req.user
    try {
        const userId = req.user.id;
        const username = req.user.username; // Username vem do Access Token
        // Log da ação
        console.log(`[Profile] Perfil acessado por User ID: ${userId} (${username})`);

        // Em uma aplicação real, você poderia buscar mais dados do DB aqui
        // const userProfile = await db.findUserById(userId); // Exemplo

        // Retorna os dados disponíveis no token (ou buscados no DB)
        res.status(200).json({
            message: "Dados do perfil obtidos com sucesso.",
            user: {
                id: req.user.id,
                username: username, // Garante que o username retornado é o do token
                role: req.user.role
                // ... outros dados do perfil se buscados no DB
            }
        });
    } catch (error) {
        // Loga erro ao buscar perfil
        console.error(`[Profile] ERRO ao obter perfil para User ID ${req?.user?.id || 'N/A'}:`, error);
        res.status(500).json({ message: 'Erro ao obter dados do perfil.' });
    }
};


module.exports = {
    registerUser, // Versão segura que não aceita role
    loginUser,
    refreshToken,
    logoutUser,
    getUserProfile
};