// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const { isBlacklisted } = require('../config/tokenBlacklist'); // Importar blacklist

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET; // Segredo do Refresh Token

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
    console.error("ERRO FATAL: Variáveis de ambiente JWT_SECRET ou JWT_REFRESH_SECRET não definidas.");
    process.exit(1);
}

/**
 * Middleware para verificar o token JWT de ACESSO.
 */
const verifyAccessToken = (req, res, next) => {
    verifyToken(req, res, next, JWT_SECRET, false); // Usa segredo de acesso, não verifica blacklist (opcional)
};

/**
 * Middleware para verificar o token JWT de REFRESH.
 * Verifica também se o token está na blacklist.
 */
const verifyRefreshToken = (req, res, next) => {
    // Refresh token geralmente vem no corpo da requisição, não no header
    const token = req.body.refreshToken;

    if (!token) {
        console.warn('[Auth Middleware] Refresh token ausente no corpo da requisição.');
        return res.status(401).json({ message: 'Refresh token não fornecido.' });
    }

    // Usamos a função genérica, passando o segredo de refresh e ativando a checagem da blacklist
    jwt.verify(token, JWT_REFRESH_SECRET, (err, decoded) => {
        handleTokenVerification(err, decoded, token, res, next, true); // true para checkBlacklist
    });
};


/**
 * Função auxiliar genérica para verificar um token.
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next function
 * @param {String} secret - O segredo JWT a ser usado para verificação
 * @param {Boolean} checkBlacklist - Se deve verificar a blacklist (usado para refresh tokens)
 */
function verifyToken(req, res, next, secret, checkBlacklist = false) {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader?.startsWith('Bearer ')) {
        console.warn('[Auth Middleware] Access Token ausente ou mal formatado no header Authorization.');
        return res.status(401).json({ message: 'Acesso não autorizado. Token não fornecido ou inválido.' });
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, secret, (err, decoded) => {
        handleTokenVerification(err, decoded, token, res, next, checkBlacklist);
    });
}


/**
 * Função auxiliar para lidar com o resultado da verificação do token.
 */
function handleTokenVerification(err, decoded, token, res, next, checkBlacklist) {
    if (err) {
        console.warn(`[Auth Middleware] Falha na verificação do token: ${err.message}`);
        let status = 403;
        let message = 'Falha na autenticação do token.';
        if (err.name === 'TokenExpiredError') {
            message = 'Token expirado.';
            status = 401; // Ou 403, dependendo da sua preferência para expirado vs inválido
        } else if (err.name === 'JsonWebTokenError') {
            message = 'Token inválido.';
        }
        return res.status(status).json({ message: message });
    }

    // Verificar blacklist se necessário (para refresh tokens)
    // Usamos o 'jti' (JWT ID) do payload do token para a blacklist
    if (checkBlacklist && decoded.jti && isBlacklisted(decoded.jti)) {
        console.warn(`[Auth Middleware] Tentativa de uso de Refresh Token (JTI: ${decoded.jti}) que está na blacklist.`);
        return res.status(401).json({ message: 'Token inválido (revogado).' }); // Token foi invalidado (logout)
    }


    // Token válido! Anexa os dados do usuário ao objeto `req`
    // IMPORTANTE: O payload de 'decoded' agora contém o que foi colocado durante a assinatura do token
    // Ex: { id: 1, username: 'marquin', role: 'admin', iat: ..., exp: ..., jti: ... (se usado) }
    req.user = decoded;
    console.log(`[Auth Middleware] Token verificado com sucesso para usuário: ${req.user.username} (ID: ${req.user.id}, Role: ${req.user.role})`);
    next();
}


/**
 * Middleware para verificar se o usuário tem um determinado papel (role).
 * Deve ser usado *depois* de verifyAccessToken.
 * @param {string | string[]} allowedRoles - Papel(is) permitido(s).
 */
const verifyRoles = (allowedRoles) => {
    return (req, res, next) => {
        if (!req?.user?.role) {
            console.warn('[Auth Middleware] Tentativa de verificação de role sem usuário autenticado ou sem role definida.');
            return res.status(401).json({ message: 'Usuário não autenticado ou sem papel definido.' });
        }

        const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

        // Verifica se o papel do usuário está na lista de papéis permitidos
        const hasRole = rolesArray.includes(req.user.role);

        if (!hasRole) {
            console.warn(`[Auth Middleware] Acesso negado para usuário ${req.user.username} (Role: ${req.user.role}). Roles permitidas: ${rolesArray.join(', ')}`);
            return res.status(403).json({ message: 'Acesso proibido. Permissões insuficientes.' }); // 403 Forbidden
        }

        console.log(`[Auth Middleware] Verificação de role bem-sucedida para usuário ${req.user.username} (Role: ${req.user.role})`);
        next(); // Usuário tem a permissão necessária
    };
};


module.exports = {
    verifyAccessToken,
    verifyRefreshToken, // Exportamos especificamente para refresh
    verifyRoles
};