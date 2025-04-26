// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const { isBlacklisted } = require('../config/tokenBlacklist'); // Importar blacklist

// dotenv.config() REMOVIDO DAQUI

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET; // Segredo do Refresh Token

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
    console.error("ERRO FATAL: Variáveis de ambiente JWT_SECRET ou JWT_REFRESH_SECRET não definidas no middleware.");
    process.exit(1);
}

/**
 * Middleware para verificar o token JWT de ACESSO.
 */
const verifyAccessToken = (req, res, next) => {
    // Chama a função genérica verifyToken para Access Tokens
    verifyToken(req, res, next, JWT_SECRET, false); // checkBlacklist = false
};

/**
 * Função auxiliar genérica para verificar um token vindo do Header Authorization Bearer.
 */
function verifyToken(req, res, next, secret, checkBlacklist = false) {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader?.startsWith('Bearer ')) {
        console.warn('[Auth] Falha: Header Authorization ausente ou mal formatado.');
        return res.status(401).json({ message: 'Acesso não autorizado. Token ausente ou formato inválido.' });
    }

    const token = authHeader.split(' ')[1];

    // Callback para jwt.verify
    jwt.verify(token, secret, (err, decoded) => {
        // CORREÇÃO: Passa 'req' para handleTokenVerification
        handleTokenVerification(req, res, next, err, decoded, token, checkBlacklist);
    });
}


/**
 * Função auxiliar para lidar com o resultado da verificação do token.
 * AGORA recebe 'req' como primeiro parâmetro.
 */
function handleTokenVerification(req, res, next, err, decoded, token, checkBlacklist) {
    if (err) {
        let status = 403;
        let message = 'Falha na autenticação do token.';
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
        // Retorna a resposta de erro para o cliente
        return res.status(status).json({ message });
    }

    // Verificar blacklist se necessário (usando JTI do token)
    if (checkBlacklist && decoded.jti && isBlacklisted(decoded.jti)) {
        // Log já acontece dentro de isBlacklisted
        return res.status(401).json({ message: 'Token inválido (revogado).' }); // Token foi invalidado (logout)
    }

    // Token válido! Anexa payload decodificado ao objeto 'req'.
    // CORREÇÃO: Agora 'req' é um parâmetro definido e acessível.
    req.user = decoded;

    // Chama o próximo middleware na cadeia (ou o controller da rota)
    next();
}


/**
 * Middleware para verificar se o usuário tem um determinado papel (role).
 * Deve ser usado *depois* de verifyAccessToken.
 * @param {string | string[]} allowedRoles - Papel(is) permitido(s).
 */
const verifyRoles = (allowedRoles) => {
    return (req, res, next) => {
        // req.user deve ter sido populado por verifyAccessToken/handleTokenVerification
        if (!req?.user?.role) {
            console.warn('[Auth] Falha RoleCheck: Usuário não autenticado ou sem role no token.');
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

        next(); // Usuário tem a permissão necessária
    };
};


module.exports = {
    verifyAccessToken,
    // verifyRefreshToken (se existisse como middleware direto, precisaria de ajuste similar)
    verifyRoles
};