// controllers/authController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database'); // db agora tem as funções de invite code
const { addToBlacklist } = require('../config/tokenBlacklist');

// dotenv.config() REMOVIDO DAQUI

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
 * Registra um novo usuário USANDO um código de convite. SEMPRE com a role 'user'.
 */
const registerUser = async (req, res) => {
    // Validação (username, password, inviteCode) feita por middleware
    const { username, password, inviteCode } = req.body;

    console.log(`[Register] Tentativa de registro para: ${username} com código: ${inviteCode}`);

    // Idealmente, usar transações do DB aqui para garantir atomicidade
    // let connectionClient = await pool.connect(); // Exemplo com pg Pool
    // await connectionClient.query('BEGIN');

    try {
        // 1. Validar o código de convite
        const codeData = await db.findInviteCode(inviteCode);

        if (!codeData) {
            console.warn(`[Register] Falha: Código de convite inválido (${inviteCode}).`);
            return res.status(400).json({ message: "Código de convite inválido." });
        }
        if (codeData.is_used) {
            console.warn(`[Register] Falha: Código de convite já utilizado (${inviteCode}). Usado em: ${codeData.used_at}`);
            return res.status(400).json({ message: "Código de convite já utilizado." });
        }
        // Opcional: Verificar expiração do código aqui se 'expires_at' for implementado

        console.log(`[Register] Código de convite '${inviteCode}' validado.`);

        // 2. Gerar hash da senha
        const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

        // 3. Criar o usuário (SEMPRE com role 'user' no registro público)
        const newUser = await db.addUser({ username, passwordHash, role: 'user' }); // Força role 'user'
        console.log(`[Register] Usuário ${username} (ID: ${newUser.id}) criado.`);

        // 4. Marcar o código de convite como usado
        const marked = await db.markInviteCodeAsUsed(inviteCode, newUser.id);
        if (!marked) {
            // Risco de race condition sem transação/lock no DB
            console.error(`[Register] ERRO CRÍTICO: Usuário ${username} criado, mas falha ao marcar código ${inviteCode} como usado!`);
            // await connectionClient.query('ROLLBACK'); // Desfaz criação do usuário se em transação
            return res.status(500).json({ message: "Erro ao finalizar registro. Código pode ter sido usado simultaneamente. Tente novamente ou contate suporte." });
        }

        // await connectionClient.query('COMMIT'); // Confirma transação

        console.log(`[Register] Sucesso: Usuário ${username} (ID: ${newUser.id}, Role: ${newUser.role}) criado usando código ${inviteCode}.`);
        res.status(201).json({
            message: 'Usuário registrado com sucesso!',
            userId: newUser.id,
            username: newUser.username,
            role: newUser.role // Será 'user'
        });

    } catch (error) {
        // await connectionClient?.query('ROLLBACK'); // Desfaz transação em caso de erro

        if (error.message === 'Nome de usuário já existe.') {
            console.warn(`[Register] Falha: Usuário ${username} já existe (durante tentativa com código ${inviteCode}).`);
            return res.status(409).json({ message: 'Nome de usuário já está em uso.' });
        }
        console.error(`[Register] ERRO FATAL ao registrar ${username} com código ${inviteCode}:`, error);
        res.status(500).json({ message: 'Erro interno no servidor ao registrar usuário.' });
    } finally {
        // Libera cliente da transação se usado
        // connectionClient?.release();
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
        const user = await db.findUserByUsername(username);

        if (user && await bcrypt.compare(password, user.passwordHash)) {
            const accessToken = generateAccessToken(user);
            const refreshToken = generateRefreshToken(user);
            console.log(`[Login] Sucesso: Autenticado ${username} (ID: ${user.id}, Role: ${user.role}). Tokens gerados.`);
            res.status(200).json({
                message: 'Login bem-sucedido!',
                accessToken: accessToken,
                refreshToken: refreshToken,
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role
                }
            });
        } else {
            console.warn(`[Login] Falha: Credenciais inválidas para ${username}.`);
            res.status(401).json({ message: 'Credenciais inválidas.' });
        }
    } catch (error) {
        console.error(`[Login] ERRO FATAL ao logar ${username}:`, error);
        res.status(500).json({ message: 'Erro interno no servidor durante o login.' });
    }
};

/**
 * Gera um novo Access Token usando um Refresh Token válido.
 */
const refreshToken = async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({ message: 'Refresh token é obrigatório.' });
    }

    try {
        jwt.verify(refreshToken, JWT_REFRESH_SECRET, async (err, decoded) => {
            if (err) {
                let status = 403; let message = 'Refresh token inválido.';
                if (err.name === 'TokenExpiredError') { status = 401; message = 'Refresh token expirado.'; }
                console.warn(`[Refresh] Falha: ${message}`);
                return res.status(status).json({ message });
            }

            const jti = decoded.jti;
            if (!jti || isBlacklisted(jti)) {
                return res.status(401).json({ message: 'Refresh token inválido (revogado).' });
            }

            const userId = decoded.id;
            const userRole = decoded.role;

            // Usando dados do token para gerar o novo Access Token
            // Para pegar o username atualizado, precisaríamos buscar no DB
            const userPayload = { id: userId, role: userRole, username: 'N/A' }; // Username N/A pois não está no refresh token

            const newAccessToken = generateAccessToken(userPayload);

            console.log(`[Refresh] Sucesso: Novo Access Token gerado para User ID ${userId}.`);
            res.status(200).json({ accessToken: newAccessToken });
        });
    } catch (error) {
        console.error(`[Refresh] ERRO ao gerar novo token:`, error);
        res.status(500).json({ message: 'Erro ao processar a renovação do token.' });
    }
};

/**
 * Invalida o Refresh Token adicionando seu JTI à blacklist.
 */
const logoutUser = async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({ message: 'Refresh token é obrigatório para logout.' });
    }

    try {
        jwt.verify(refreshToken, JWT_REFRESH_SECRET, { ignoreExpiration: true }, (err, decoded) => {
            if (err && err.name !== 'TokenExpiredError') {
                console.warn(`[Logout] Aviso: Tentativa de logout com token de refresh inválido (não expirado). Erro: ${err.message}`);
                return res.status(200).json({ message: 'Logout realizado (token inválido).' });
            }

            const jti = decoded?.jti;
            const userId = decoded?.id || 'N/A';

            if (jti) {
                addToBlacklist(jti);
                console.log(`[Logout] Sucesso: Refresh Token (JTI: ${jti}) invalidado para User ID ${userId}.`);
                res.status(200).json({ message: 'Logout bem-sucedido!' });
            } else {
                console.warn(`[Logout] Aviso: Token de refresh processado, mas sem JTI. Não foi possível adicionar à blacklist (User ID: ${userId}).`);
                res.status(200).json({ message: 'Logout processado.' });
            }
        });
    } catch (error) {
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
        const username = req.user.username;
        console.log(`[Profile] Perfil acessado por User ID: ${userId} (${username})`);

        res.status(200).json({
            message: "Dados do perfil obtidos com sucesso.",
            user: {
                id: req.user.id,
                username: username,
                role: req.user.role
            }
        });
    } catch (error) {
        console.error(`[Profile] ERRO ao obter perfil para User ID ${req?.user?.id || 'N/A'}:`, error);
        res.status(500).json({ message: 'Erro ao obter dados do perfil.' });
    }
};

module.exports = {
    registerUser, // Versão atualizada com invite code
    loginUser,
    refreshToken,
    logoutUser,
    getUserProfile
};