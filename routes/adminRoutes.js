// routes/adminRoutes.js
const express = require('express');
const adminController = require('../controllers/adminController');
const { verifyAccessToken, verifyRoles } = require('../middleware/authMiddleware');
const { createUserByAdminValidationRules, generateInviteCodeValidationRules } = require('../middleware/validationRules');
const handleValidationErrors = require('../middleware/handleValidationErrors');

const router = express.Router();

// --- Middleware de Proteção ---
// Garante que todas as rotas neste arquivo exigem login E role 'admin'
router.use(verifyAccessToken, verifyRoles('admin'));

// --- Rotas de Administração ---

/**
 * @api {post} /api/admin/invite-codes Gerar Código(s) de Convite
 * @apiVersion 1.1.0
 * @apiName GenerateInvites
 * @apiGroup Admin
 * @apiPermission admin
 * @apiDescription Gera um ou mais códigos de convite únicos para registro de novos usuários. Requer autenticação de Admin.
 * @apiHeader {String} Authorization Token JWT de acesso do Admin ("Bearer eyJhbGci...").
 * @apiBody {Number} [quantity=1] Quantidade de códigos a serem gerados (Opcional, 1-20).
 * @apiSuccess {String} message Mensagem de sucesso.
 * @apiSuccess {String[]} codes Array com os códigos gerados.
 * @apiSuccess {Object[]} [failures] Array de falhas (se houver).
 * @apiSuccessExample {json} Sucesso (201 Created):
 * HTTP/1.1 201 Created
 * {
 * "message": "2 código(s) de convite gerado(s) com sucesso.",
 * "codes": [
 * "a1b2c3d4e5f6a1b2c3d4e5f6",
 * "f6e5d4c3b2a1f6e5d4c3b2a1"
 * ]
 * }
 * @apiError (Erro 400) BadRequest Quantidade inválida.
 * @apiError (Erro 401) Unauthorized Admin não autenticado.
 * @apiError (Erro 403) Forbidden Usuário não é admin.
 * @apiError (Erro 500) InternalServerError Erro ao gerar/salvar códigos.
 */
router.post(
    '/invite-codes',
    generateInviteCodeValidationRules(),
    handleValidationErrors,
    adminController.generateInviteCodes
);

/**
 * @api {post} /api/admin/users Criar Usuário (Admin)
 * @apiVersion 1.1.0
 * @apiName CreateUserAdmin
 * @apiGroup Admin
 * @apiPermission admin
 * @apiDescription Cria uma nova conta de usuário diretamente. Permite definir o papel (role). Requer autenticação de Admin.
 * @apiHeader {String} Authorization Token JWT de acesso do Admin ("Bearer eyJhbGci...").
 * @apiBody {String} username Nome de usuário único para a nova conta.
 * @apiBody {String} password Senha para a nova conta.
 * @apiBody {String} [role='user'] Papel a ser atribuído (ex: 'user', 'admin', 'moderator'). Opcional, padrão 'user'.
 * @apiSuccess {String} message Mensagem de sucesso.
 * @apiSuccess {Number} userId ID do novo usuário.
 * @apiSuccess {String} username Nome de usuário criado.
 * @apiSuccess {String} role Papel atribuído.
 * @apiSuccessExample {json} Sucesso (201 Created):
 * HTTP/1.1 201 Created
 * {
 * "message": "Usuário criado com sucesso pelo administrador!",
 * "userId": 6,
 * "username": "novo_moderador",
 * "role": "moderator"
 * }
 * @apiError (Erro 400) BadRequest Dados inválidos (campos faltando, role inválido).
 * @apiError (Erro 401) Unauthorized Admin não autenticado.
 * @apiError (Erro 403) Forbidden Usuário não é admin.
 * @apiError (Erro 409) Conflict Nome de usuário já existe.
 * @apiError (Erro 500) InternalServerError Erro interno no servidor.
 */
router.post(
    '/users',
    createUserByAdminValidationRules(),
    handleValidationErrors,
    adminController.createUserByAdmin
);

/**
 * @api {get} /api/admin/users Listar Todos os Usuários
 * @apiVersion 1.1.0
 * @apiName GetAllUsers
 * @apiGroup Admin
 * @apiPermission admin
 * @apiDescription Retorna uma lista de todos os usuários registrados (sem informações sensíveis). Requer autenticação de Admin.
 * @apiHeader {String} Authorization Token JWT de acesso do Admin ("Bearer eyJhbGci...").
 *
 * @apiSuccess {Object[]} users Array de objetos de usuário.
 * @apiSuccess {Number} users.id ID do usuário.
 * @apiSuccess {String} users.username Nome de usuário.
 * @apiSuccess {String} users.role Papel do usuário.
 * @apiSuccess {String} users.createdAt Timestamp de criação.
 *
 * @apiSuccessExample {json} Sucesso (200 OK):
 * HTTP/1.1 200 OK
 * [
 * {
 * "id": 1,
 * "username": "admin",
 * "role": "admin",
 * "createdAt": "2025-04-26T20:00:00.000Z"
 * },
 * {
 * "id": 2,
 * "username": "testuser",
 * "role": "user",
 * "createdAt": "2025-04-26T20:05:10.000Z"
 * }
 * ]
 *
 * @apiError (Erro 401) Unauthorized Admin não autenticado.
 * @apiError (Erro 403) Forbidden Usuário não é admin.
 * @apiError (Erro 500) InternalServerError Erro interno no servidor.
 */
router.get(
    '/users',
    adminController.getAllUsers // Controller que busca e retorna os dados
);

/**
 * @api {get} /api/admin/invite-codes Listar Códigos de Convite
 * @apiVersion 1.1.0
 * @apiName GetAllInviteCodes
 * @apiGroup Admin
 * @apiPermission admin
 * @apiDescription Retorna uma lista de todos os códigos de convite gerados. Requer autenticação de Admin.
 * @apiHeader {String} Authorization Token JWT de acesso do Admin ("Bearer eyJhbGci...").
 *
 * @apiSuccess {Object[]} codes Array de objetos de código de convite.
 * @apiSuccess {Number} codes.id ID do código.
 * @apiSuccess {String} codes.code O código em si.
 * @apiSuccess {Boolean} codes.is_used Se o código já foi utilizado.
 * @apiSuccess {Number} codes.created_by ID do admin que criou.
 * @apiSuccess {Number} codes.used_by ID do usuário que usou (ou null).
 * @apiSuccess {String} codes.createdAt Timestamp de criação.
 * @apiSuccess {String} codes.used_at Timestamp de uso (ou null).
 *
 * @apiSuccessExample {json} Sucesso (200 OK):
 * HTTP/1.1 200 OK
 * [
 * {
 * "id": 1,
 * "code": "a1b2c3d4e5f6a1b2c3d4e5f6",
 * "is_used": true,
 * "created_by": 1,
 * "used_by": 3,
 * "createdAt": "2025-04-26T21:00:00.000Z",
 * "used_at": "2025-04-26T21:15:00.000Z"
 * },
 * {
 * "id": 2,
 * "code": "f6e5d4c3b2a1f6e5d4c3b2a1",
 * "is_used": false,
 * "created_by": 1,
 * "used_by": null,
 * "createdAt": "2025-04-26T21:01:00.000Z",
 * "used_at": null
 * }
 * ]
 *
 * @apiError (Erro 401) Unauthorized Admin não autenticado.
 * @apiError (Erro 403) Forbidden Usuário não é admin.
 * @apiError (Erro 500) InternalServerError Erro interno no servidor.
 */
router.get(
    '/invite-codes',
    adminController.getAllInviteCodes // Controller que busca e retorna os dados
);


module.exports = router;