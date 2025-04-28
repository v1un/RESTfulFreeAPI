// controllers/authController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
// IMPORTANTE: isBlacklisted é usado em refreshToken e logoutUser
const { addToBlacklist, isBlacklisted } = require('../config/tokenBlacklist'); // <-- CORREÇÃO: Adicionado isBlacklisted aqui

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

function generateAccessToken(user) {
    const payload = {
        id: user.id,
        username: user.username,
        role: user.role,
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function generateRefreshToken(user) {
    const payload = {
        id: user.id,
        role: user.role,
    };
    const options = {
        expiresIn: JWT_REFRESH_EXPIRES_IN,
        jwtid: uuidv4()
    };
    return jwt.sign(payload, JWT_REFRESH_SECRET, options);
}

// --- Controladores das Rotas ---

const registerUser = async (req, res) => {
    const { username, password, inviteCode } = req.body;
    console.log(`[Register] Tentativa de registro para: ${username} com código: ${inviteCode}`);
    try {
        const codeData = await db.findInviteCode(inviteCode);
        if (!codeData) {
            console.warn(`[Register] Falha: Código de convite inválido (${inviteCode}).`);
            return res.status(400).json({ message: "Código de convite inválido." });
        }
        if (codeData.is_used) {
            console.warn(`[Register] Falha: Código de convite já utilizado (${inviteCode}). Usado em: ${codeData.used_at}`);
            return res.status(400).json({ message: "Código de convite já utilizado." });
        }
        console.log(`[Register] Código de convite '${inviteCode}' validado.`);
        const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
        const newUser = await db.addUser({ username, passwordHash, role: 'user' });
        console.log(`[Register] Usuário ${username} (ID: ${newUser.id}) criado.`);
        const marked = await db.markInviteCodeAsUsed(inviteCode, newUser.id);
        if (!marked) {
            console.error(`[Register] ERRO CRÍTICO: Usuário ${username} criado, mas falha ao marcar código ${inviteCode} como usado!`);
            return res.status(500).json({ message: "Erro ao finalizar registro. Contate o suporte." });
        }
        console.log(`[Register] Sucesso: Usuário ${username} (ID: ${newUser.id}, Role: ${newUser.role}) criado usando código ${inviteCode}.`);
        res.status(201).json({
            message: 'Usuário registrado com sucesso!',
            userId: newUser.id,
            username: newUser.username,
            role: newUser.role
        });
    } catch (error) {
        if (error.message === 'Nome de usuário já existe.') {
            console.warn(`[Register] Falha: Usuário ${username} já existe (durante tentativa com código ${inviteCode}).`);
            return res.status(409).json({ message: 'Nome de usuário já está em uso.' });
        }
        console.error(`[Register] ERRO FATAL ao registrar ${username} com código ${inviteCode}:`, error);
        res.status(500).json({ message: 'Erro interno no servidor ao registrar usuário.' });
    }
};

const loginUser = async (req, res) => {
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

const refreshToken = async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        return res.status(400).json({ message: 'Refresh token é obrigatório.' });
    }
    try {
        // Verifica o refresh token usando o segredo correto
        jwt.verify(refreshToken, JWT_REFRESH_SECRET, async (err, decoded) => {
            if (err) {
                let status = 403; let message = 'Refresh token inválido.';
                if (err.name === 'TokenExpiredError') { status = 401; message = 'Refresh token expirado.'; }
                console.warn(`[Refresh] Falha: ${message}`);
                return res.status(status).json({ message });
            }

            // Verifica se o token está na blacklist (JTI)
            const jti = decoded.jti;
            // CORREÇÃO: Agora isBlacklisted está definida por causa do require no topo
            if (!jti || isBlacklisted(jti)) {
                // O log de warning já acontece dentro de isBlacklisted se encontrado
                return res.status(401).json({ message: 'Refresh token inválido (revogado).' });
            }

            // Refresh token é válido e não está na blacklist. Gera novo Access Token.
            const userId = decoded.id;
            const userRole = decoded.role;
            const userPayload = { id: userId, role: userRole, username: 'N/A' }; // Username não vem no refresh token

            const newAccessToken = generateAccessToken(userPayload);

            console.log(`[Refresh] Sucesso: Novo Access Token gerado para User ID ${userId}.`);
            res.status(200).json({ accessToken: newAccessToken });
        });
    } catch (error) {
        console.error(`[Refresh] ERRO ao gerar novo token:`, error);
        res.status(500).json({ message: 'Erro ao processar a renovação do token.' });
    }
};

const logoutUser = async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        return res.status(400).json({ message: 'Refresh token é obrigatório para logout.' });
    }
    try {
        // Verifica o token para pegar o JTI, ignorando a expiração para invalidar mesmo se expirado
        jwt.verify(refreshToken, JWT_REFRESH_SECRET, { ignoreExpiration: true }, (err, decoded) => {
            if (err && err.name !== 'TokenExpiredError') {
                console.warn(`[Logout] Aviso: Tentativa de logout com token de refresh inválido (não expirado). Erro: ${err.message}`);
                return res.status(200).json({ message: 'Logout realizado (token inválido).' });
            }
            const jti = decoded?.jti;
            const userId = decoded?.id || 'N/A';
            if (jti) {
                // CORREÇÃO: addToBlacklist também está disponível via require no topo
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

const getUserProfile = async (req, res) => {
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
    registerUser,
    loginUser,
    refreshToken,
    logoutUser,
    getUserProfile
};