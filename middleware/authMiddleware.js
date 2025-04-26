// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config(); // Carrega variáveis de ambiente do .env.example

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error("ERRO FATAL: Variável de ambiente JWT_SECRET não definida.");
    process.exit(1); // Encerra a aplicação se o segredo JWT não estiver configurado
}

/**
 * Middleware para verificar o token JWT presente no header Authorization.
 * Se o token for válido, anexa os dados do usuário decodificado a `req.user`.
 * Caso contrário, retorna um erro 401 ou 403.
 */
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    // Verifica se o header Authorization existe e está no formato Bearer <token>
    if (!authHeader?.startsWith('Bearer ')) {
        console.warn('[Auth Middleware] Token ausente ou mal formatado.');
        // 401 Unauthorized - Faltando credenciais
        return res.status(401).json({ message: 'Acesso não autorizado. Token não fornecido ou inválido.' });
    }

    const token = authHeader.split(' ')[1]; // Extrai o token

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            console.warn(`[Auth Middleware] Falha na verificação do token: ${err.message}`);
            // 403 Forbidden - Credenciais fornecidas, mas inválidas/expiradas
            if (err.name === 'TokenExpiredError') {
                return res.status(403).json({ message: 'Token expirado. Por favor, faça login novamente.' });
            }
            if (err.name === 'JsonWebTokenError') {
                return res.status(403).json({ message: 'Token inválido.' });
            }
            // Outros erros possíveis
            return res.status(403).json({ message: 'Falha na autenticação do token.' });
        }

        // Token válido! Anexa os dados do usuário (payload do token) ao objeto `req`
        // Certifique-se de que o payload do token contenha informações úteis (como id, username, roles)
        req.user = decoded; // Ex: { id: 1, username: 'marquin', iat: ..., exp: ... }
        console.log(`[Auth Middleware] Token verificado com sucesso para usuário: ${req.user.username} (ID: ${req.user.id})`);
        next(); // Passa para o próximo middleware ou rota
    });
};

module.exports = { verifyToken };