// routes/authRoutes.js
const express = require('express');
const authController = require('../controllers/authController');
const { verifyAccessToken, verifyRefreshToken, verifyRoles } = require('../middleware/authMiddleware');
const { registerValidationRules, loginValidationRules, refreshTokenValidationRules } = require('../middleware/validationRules');
const handleValidationErrors = require('../middleware/handleValidationErrors');

const router = express.Router();

// --- Rotas Públicas ---

// POST /api/auth/register
router.post(
    '/register',
    registerValidationRules(), // Aplica regras de validação
    handleValidationErrors,    // Trata erros de validação
    authController.registerUser
);

// POST /api/auth/login
router.post(
    '/login',
    loginValidationRules(),    // Aplica regras de validação
    handleValidationErrors,     // Trata erros de validação
    authController.loginUser
);

// POST /api/auth/refresh
// Endpoint para obter um novo access token usando um refresh token
router.post(
    '/refresh',
    refreshTokenValidationRules(), // Valida presença e formato do refresh token
    handleValidationErrors,
    // NÃO usamos verifyRefreshToken aqui, pois ele já faz a validação no controller
    // O controller precisa do token bruto para verificar.
    // Se verifyRefreshToken fosse um middleware aqui, ele já consumiria o token ou daria erro antes do controller.
    // A verificação do refresh token (incluindo blacklist) será feita dentro do jwt.verify no refreshToken controller
    // A abordagem alternativa seria um middleware que *apenas decodifica* sem verificar expiração/blacklist
    // e o controller faz o resto. Mantendo a lógica no controller por agora.
    // REFATORAÇÃO POSSÍVEL: Criar middleware verifyRefreshTokenBody que chama jwt.verify
    authController.refreshToken
    // ATENÇÃO: A implementação atual de verifyRefreshToken no authMiddleware.js
    // foi feita para ser usada como middleware, buscando o token no body.
    // Ajustando para usar no controller ou refatorar middleware.
    // POR SIMPLICIDADE, vamos manter a validação e verificação DENTRO do controller refreshToken por enquanto.
);


// POST /api/auth/logout
// Requer um refresh token válido no corpo para invalidá-lo (adicionar à blacklist)
router.post(
    '/logout',
    refreshTokenValidationRules(), // Valida presença e formato do refresh token
    handleValidationErrors,
    authController.logoutUser
);


// --- Rotas Protegidas (Exigem Access Token Válido) ---

// GET /api/auth/profile
// Exemplo de rota protegida que retorna informações do usuário logado
router.get(
    '/profile',
    verifyAccessToken, // 1º Verifica se o Access Token é válido
    authController.getUserProfile // 2º Executa a lógica do controller
);

// GET /api/auth/admin-only
// Exemplo de rota protegida que exige o papel 'admin'
router.get(
    '/admin-only',
    verifyAccessToken,      // 1º Verifica Access Token
    verifyRoles('admin'), // 2º Verifica se o usuário tem o papel 'admin'
    (req, res) => {         // 3º Executa a lógica específica
        res.status(200).json({
            message: `Olá Admin ${req.user.username}! Você tem acesso a esta área restrita.`,
            userInfo: req.user
        });
    }
);

// Exemplo com múltiplos papéis permitidos
router.get(
    '/staff-area',
    verifyAccessToken,
    verifyRoles(['admin', 'moderator']), // Permite admin OU moderator
    (req, res) => {
        res.status(200).json({
            message: `Bem-vindo à área de Staff, ${req.user.username}!`,
            role: req.user.role
        });
    }
);


module.exports = router;