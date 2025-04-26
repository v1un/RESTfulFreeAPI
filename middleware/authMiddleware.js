// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const { isBlacklisted } = require('../config/tokenBlacklist'); // Importar blacklist

// dotenv.config() FOI REMOVIDO DAQUI

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET; // Segredo do Refresh Token

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
    console.error("ERRO FATAL: Variáveis de ambiente JWT_SECRET ou JWT_REFRESH_SECRET não definidas no middleware.");
    // Ou chegaram vazias do server.js
    process.exit(1);
}

/**
 * Middleware para verificar o token JWT de ACESSO.
 */
const verifyAccessToken = (req, res, next) => {
    verifyToken(req, res, next, JWT_SECRET, false); // Usa segredo de acesso, não verifica blacklist
};

/**
 * Middleware para verificar o token JWT de REFRESH (geralmente usado internamente pelo controller).
 * Se for usado como middleware de rota, precisa garantir que o token está onde ele espera (ex: req.body.refreshToken)
 * A implementação atual é mais um helper para ser chamado pelo controller ou outro middleware.
 */
// const verifyRefreshToken = (req, res, next) => { ... } // Removido como middleware de rota direto

/**
 * Função auxiliar genérica para verificar um token vindo do Header Authorization Bearer.
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next function
 * @param {String} secret - O segredo JWT a ser usado para verificação
 * @param {Boolean} checkBlacklist - Se deve verificar a blacklist (usado para refresh tokens se vierem do header)
 */
function verifyToken(req, res, next, secret, checkBlacklist = false) {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader?.startsWith('Bearer ')) {
        console.warn('[Auth] Falha: Header Authorization ausente ou mal formatado.');
        return res.status(401).json({ message: 'Acesso não autorizado. Token ausente ou formato inválido.' });
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, secret, (err, decoded) => {
        handleTokenVerification(err, decoded, token, res, next, checkBlacklist);
    });
}


/**
 * Função auxiliar para lidar com o resultado da verificação do token (chamada por jwt.verify).
 */
function handleTokenVerification(err, decoded, token, res, next, checkBlacklist) {
    if (err) {
        let status = 403;
        let message = 'Falha na autenticação do token.';
        // Tenta decodificar mesmo com erro para logar o usuário, se possível
        const partiallyDecoded = jwt.decode(token, {complete: true});
        const usernameForLog = partiallyDecoded?.payload?.username || 'N/A';

        if (err.name === 'TokenExpiredError') {
            message = 'Token expirado.'; status = 401;
            console.warn(`[Auth] Falha: Token expirado (Usuário: ${usernameForLog}).`);
        } else if (err.name === 'JsonWebTokenError') {
            message = 'Token inválido.';
            console.warn(`[Auth] Falha: Token inválido (Usuário: ${usernameForLog}, Erro: ${err.message}).`);
        } else {
            console.warn(`[Auth] Falha: Erro desconhecido na verificação do token (Usuário: ${usernameForLog}, Erro: ${err.message}).`);
        }
        return res.status(status).json({ message });
    }

    // Verificar blacklist se necessário (usando JTI do token)
    if (checkBlacklist && decoded.jti && isBlacklisted(decoded.jti)) {
        // Log já acontece dentro de isBlacklisted
        return res.status(401).json({ message: 'Token inválido (revogado).' }); // Token foi invalidado (logout)
    }

    // Token válido! Anexa payload decodificado ao request.
    req.user = decoded;
    // Log de sucesso removido para diminuir ruído
    // console.log(`[Auth] Token verificado: User ${req.user.username} (ID: ${req.user.id}, Role: ${req.user.role})`);
    next();
}


/**
 * Middleware para verificar se o usuário tem um determinado papel (role).
 * Deve ser usado *depois* de verifyAccessToken.
 * @param {string | string[]} allowedRoles - Papel(is) permitido(s).
 */
const verifyRoles = (allowedRoles) => {
    return (req, res, next) => {
        // req.user deve ter sido populado por verifyAccessToken
        if (!req?.user?.role) {
            console.warn('[Auth] Falha RoleCheck: Usuário não autenticado ou sem role no token.');
            // Usar 403 Forbidden aqui, pois o usuário está autenticado, mas não autorizado para o recurso
            return res.status(403).json({ message: 'Acesso proibido. Papel do usuário não definido no token.' });
        }

        const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
        const userRole = req.user.role;

        // Verifica se o papel do usuário está na lista de papéis permitidos
        const hasRole = rolesArray.includes(userRole);

        if (!hasRole) {
            console.warn(`[Auth] Acesso NEGADO por Role: User ${req.user.username} (Role: ${userRole}) tentou acessar rota para ${rolesArray.join('/')}.`);
            return res.status(403).json({ message: 'Acesso proibido. Permissões insuficientes.' }); // 403 Forbidden
        }

        // Log de sucesso da verificação de role (opcional)
        // console.log(`[Auth] RoleCheck OK: User ${req.user.username} (Role: ${userRole})`);
        next(); // Usuário tem a permissão necessária
    };
};


module.exports = {
    verifyAccessToken,
    // verifyRefreshToken não é exportado como middleware de rota direto
    verifyRoles
};