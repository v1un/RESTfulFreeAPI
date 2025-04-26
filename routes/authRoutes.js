// routes/authRoutes.js - COMPLETO com comentários apiDoc

const express = require('express');
const authController = require('../controllers/authController');
const { verifyAccessToken, verifyRoles } = require('../middleware/authMiddleware');
const { registerValidationRules, loginValidationRules, refreshTokenValidationRules } = require('../middleware/validationRules');
const handleValidationErrors = require('../middleware/handleValidationErrors');

const router = express.Router();

// --- Rotas Públicas ---

/**
 * @api {post} /api/auth/register Registrar Novo Usuário
 * @apiVersion 1.1.0
 * @apiName Register
 * @apiGroup Autenticação
 * @apiDescription Cria uma nova conta de usuário. A role padrão será sempre 'user'.
 *
 * @apiBody {String} username Nome de usuário único (mínimo 3 caracteres).
 * @apiBody {String} password Senha (mínimo 6 caracteres).
 *
 * @apiSuccess {String} message Mensagem de sucesso.
 * @apiSuccess {Number} userId ID do novo usuário.
 * @apiSuccess {String} username Nome de usuário registrado.
 * @apiSuccess {String} role Papel atribuído ('user').
 *
 * @apiSuccessExample {json} Sucesso (201 Created):
 * HTTP/1.1 201 Created
 * {
 * "message": "Usuário registrado com sucesso!",
 * "userId": 5,
 * "username": "novo_usuario",
 * "role": "user"
 * }
 *
 * @apiError (Erro 400) BadRequest Dados inválidos (ex: campos faltando, senha curta).
 * @apiErrorExample {json} Erro 400:
 * HTTP/1.1 400 Bad Request
 * {
 * "message": "Senha deve ter pelo menos 6 caracteres."
 * }
 *
 * @apiError (Erro 409) Conflict Nome de usuário já existe.
 * @apiErrorExample {json} Erro 409:
 * HTTP/1.1 409 Conflict
 * {
 * "message": "Nome de usuário já está em uso."
 * }
 *
 * @apiError (Erro 500) InternalServerError Erro interno no servidor.
 * @apiErrorExample {json} Erro 500:
 * HTTP/1.1 500 Internal Server Error
 * {
 * "message": "Erro interno no servidor ao registrar usuário."
 * }
 */
router.post(
    '/register',
    registerValidationRules(),
    handleValidationErrors,
    authController.registerUser
);

/**
 * @api {post} /api/auth/login Login de Usuário
 * @apiVersion 1.1.0
 * @apiName Login
 * @apiGroup Autenticação
 * @apiDescription Autentica um usuário com username e password, retornando tokens JWT.
 *
 * @apiBody {String} username Nome de usuário registrado.
 * @apiBody {String} password Senha do usuário.
 *
 * @apiSuccess {String} message Mensagem de sucesso.
 * @apiSuccess {String} accessToken Token JWT de acesso (curta duração).
 * @apiSuccess {String} refreshToken Token JWT de atualização (longa duração).
 * @apiSuccess {Object} user Informações básicas do usuário logado.
 * @apiSuccess {Number} user.id ID do usuário.
 * @apiSuccess {String} user.username Nome de usuário.
 * @apiSuccess {String} user.role Papel do usuário.
 *
 * @apiSuccessExample {json} Sucesso (200 OK):
 * HTTP/1.1 200 OK
 * {
 * "message": "Login bem-sucedido!",
 * "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 * "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 * "user": {
 * "id": 1,
 * "username": "admin",
 * "role": "admin"
 * }
 * }
 *
 * @apiError (Erro 400) BadRequest Dados inválidos (campos faltando).
 * @apiErrorExample {json} Erro 400:
 * HTTP/1.1 400 Bad Request
 * {
 * "message": "Nome de usuário é obrigatório."
 * }
 *
 * @apiError (Erro 401) Unauthorized Credenciais inválidas (usuário não existe ou senha incorreta).
 * @apiErrorExample {json} Erro 401:
 * HTTP/1.1 401 Unauthorized
 * {
 * "message": "Credenciais inválidas."
 * }
 *
 * @apiError (Erro 500) InternalServerError Erro interno no servidor.
 * @apiErrorExample {json} Erro 500:
 * HTTP/1.1 500 Internal Server Error
 * {
 * "message": "Erro interno no servidor durante o login."
 * }
 */
router.post(
    '/login',
    loginValidationRules(),
    handleValidationErrors,
    authController.loginUser
);

/**
 * @api {post} /api/auth/refresh Renovar Access Token
 * @apiVersion 1.1.0
 * @apiName RefreshToken
 * @apiGroup Autenticação
 * @apiDescription Gera um novo Access Token usando um Refresh Token válido.
 *
 * @apiBody {String} refreshToken O Refresh Token obtido durante o login.
 *
 * @apiSuccess {String} accessToken Novo token JWT de acesso (curta duração).
 *
 * @apiSuccessExample {json} Sucesso (200 OK):
 * HTTP/1.1 200 OK
 * {
 * "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI..."
 * }
 *
 * @apiError (Erro 400) BadRequest Refresh token não fornecido ou formato inválido.
 * @apiErrorExample {json} Erro 400:
 * HTTP/1.1 400 Bad Request
 * {
 * "message": "Refresh token é obrigatório."
 * }
 *
 * @apiError (Erro 401) Unauthorized Refresh token inválido, expirado ou revogado.
 * @apiErrorExample {json} Erro 401 (Expirado):
 * HTTP/1.1 401 Unauthorized
 * {
 * "message": "Refresh token expirado."
 * }
 * @apiErrorExample {json} Erro 401 (Revogado):
 * HTTP/1.1 401 Unauthorized
 * {
 * "message": "Refresh token inválido (revogado)."
 * }
 *
 * @apiError (Erro 500) InternalServerError Erro interno no servidor.
 * @apiErrorExample {json} Erro 500:
 * HTTP/1.1 500 Internal Server Error
 * {
 * "message": "Erro ao processar a renovação do token."
 * }
 */
router.post(
    '/refresh',
    refreshTokenValidationRules(),
    handleValidationErrors,
    authController.refreshToken
);

/**
 * @api {post} /api/auth/logout Logout (Invalidar Token)
 * @apiVersion 1.1.0
 * @apiName Logout
 * @apiGroup Autenticação
 * @apiDescription Invalida o Refresh Token fornecido, adicionando-o a uma blacklist no servidor.
 *
 * @apiBody {String} refreshToken O Refresh Token que deseja invalidar.
 *
 * @apiSuccess {String} message Mensagem indicando sucesso ou que o token já era inválido.
 *
 * @apiSuccessExample {json} Sucesso (200 OK):
 * HTTP/1.1 200 OK
 * {
 * "message": "Logout bem-sucedido!"
 * }
 * @apiSuccessExample {json} Sucesso (Token já inválido):
 * HTTP/1.1 200 OK
 * {
 * "message": "Logout realizado (token já inválido)."
 * }
 *
 * @apiError (Erro 400) BadRequest Refresh token não fornecido ou erro ao invalidar.
 * @apiErrorExample {json} Erro 400:
 * HTTP/1.1 400 Bad Request
 * {
 * "message": "Refresh token é obrigatório para logout."
 * }
 *
 * @apiError (Erro 500) InternalServerError Erro interno no servidor.
 * @apiErrorExample {json} Erro 500:
 * HTTP/1.1 500 Internal Server Error
 * {
 * "message": "Erro interno no servidor durante o logout."
 * }
 */
router.post(
    '/logout',
    refreshTokenValidationRules(),
    handleValidationErrors,
    authController.logoutUser
);


// --- Rotas Protegidas ---

/**
 * @api {get} /api/auth/profile Obter Perfil do Usuário
 * @apiVersion 1.1.0
 * @apiName GetUserProfile
 * @apiGroup Usuário
 * @apiPermission user, admin, moderator // Indica que requer autenticação
 * @apiDescription Retorna informações básicas do usuário logado (associado ao Access Token).
 *
 * @apiHeader {String} Authorization Token JWT de acesso precedido por "Bearer ". Ex: Bearer eyJhbGci...
 *
 * @apiSuccess {String} message Mensagem de sucesso.
 * @apiSuccess {Object} user Informações do usuário.
 * @apiSuccess {Number} user.id ID do usuário.
 * @apiSuccess {String} user.username Nome de usuário.
 * @apiSuccess {String} user.role Papel do usuário.
 *
 * @apiSuccessExample {json} Sucesso (200 OK):
 * HTTP/1.1 200 OK
 * {
 * "message": "Dados do perfil obtidos com sucesso.",
 * "user": {
 * "id": 1,
 * "username": "admin",
 * "role": "admin"
 * }
 * }
 *
 * @apiError (Erro 401) Unauthorized Token ausente, inválido ou expirado.
 * @apiErrorExample {json} Erro 401:
 * HTTP/1.1 401 Unauthorized
 * {
 * "message": "Acesso não autorizado. Token não fornecido ou inválido."
 * }
 *
 * @apiError (Erro 500) InternalServerError Erro interno no servidor.
 * @apiErrorExample {json} Erro 500:
 * HTTP/1.1 500 Internal Server Error
 * {
 * "message": "Erro ao obter dados do perfil."
 * }
 */
router.get(
    '/profile',
    verifyAccessToken, // Middleware que verifica o Access Token
    authController.getUserProfile // Controller que busca/retorna os dados
);

/**
 * @api {get} /api/auth/admin-only Rota Restrita Admin
 * @apiVersion 1.1.0
 * @apiName AdminOnly
 * @apiGroup Admin
 * @apiPermission admin // Indica que requer role 'admin'
 * @apiDescription Exemplo de rota que só pode ser acessada por usuários com papel 'admin'.
 *
 * @apiHeader {String} Authorization Token JWT de acesso precedido por "Bearer ".
 *
 * @apiSuccess {String} message Mensagem de boas-vindas ao admin.
 * @apiSuccess {Object} userInfo Informações do usuário admin logado.
 *
 * @apiSuccessExample {json} Sucesso (200 OK):
 * HTTP/1.1 200 OK
 * {
 * "message": "Olá Admin admin! Você tem acesso a esta área restrita.",
 * "userInfo": {
 * "id": 1,
 * "username": "admin",
 * "role": "admin",
 * "iat": 1678886400,
 * "exp": 1678887300
 * }
 * }
 *
 * @apiError (Erro 401) Unauthorized Token ausente, inválido ou expirado.
 * @apiError (Erro 403) Forbidden Usuário autenticado, mas não possui a role 'admin'.
 * @apiErrorExample {json} Erro 403:
 * HTTP/1.1 403 Forbidden
 * {
 * "message": "Acesso proibido. Permissões insuficientes."
 * }
 * @apiError (Erro 500) InternalServerError Erro interno no servidor.
 */
router.get(
    '/admin-only',
    verifyAccessToken,
    verifyRoles('admin'), // Exige role 'admin'
    (req, res) => {
        res.status(200).json({
            message: `Olá Admin ${req.user.username}! Você tem acesso a esta área restrita.`,
            userInfo: req.user
        });
    }
);

/**
 * @api {get} /api/auth/staff-area Rota Restrita Staff
 * @apiVersion 1.1.0
 * @apiName StaffArea
 * @apiGroup Staff
 * @apiPermission admin, moderator // Indica que requer role 'admin' OU 'moderator'
 * @apiDescription Exemplo de rota acessível por múltiplos papéis ('admin', 'moderator').
 *
 * @apiHeader {String} Authorization Token JWT de acesso precedido por "Bearer ".
 *
 * @apiSuccess {String} message Mensagem de boas-vindas ao staff.
 * @apiSuccess {String} role Papel do usuário logado.
 *
 * @apiSuccessExample {json} Sucesso (200 OK):
 * HTTP/1.1 200 OK
 * {
 * "message": "Bem-vindo à área de Staff, moderador_legal!",
 * "role": "moderator"
 * }
 *
 * @apiError (Erro 401) Unauthorized Token ausente, inválido ou expirado.
 * @apiError (Erro 403) Forbidden Usuário autenticado, mas não possui as roles permitidas.
 * @apiErrorExample {json} Erro 403:
 * HTTP/1.1 403 Forbidden
 * {
 * "message": "Acesso proibido. Permissões insuficientes."
 * }
 * @apiError (Erro 500) InternalServerError Erro interno no servidor.
 */
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