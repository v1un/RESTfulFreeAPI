// routes/adminRoutes.js
const express = require('express');
const adminController = require('../controllers/adminController');
const { verifyAccessToken, verifyRoles } = require('../middleware/authMiddleware');
const { createUserByAdminValidationRules, generateInviteCodeValidationRules } = require('../middleware/validationRules'); // Importar novas regras
const handleValidationErrors = require('../middleware/handleValidationErrors');

const router = express.Router();

// Middleware para garantir que todas as rotas aqui são para admins
router.use(verifyAccessToken, verifyRoles('admin'));

// --- Rotas de Administração ---

/**
 * @api {post} /api/admin/invite-codes Gerar Código(s) de Convite
 * @apiVersion 1.1.0
 * @apiName GenerateInvites
 * @apiGroup Admin
 * @apiPermission admin
 * @apiDescription Gera um ou mais códigos de convite únicos para registro de novos usuários. Requer autenticação de Admin.
 *
 * @apiHeader {String} Authorization Token JWT de acesso do Admin ("Bearer eyJhbGci...").
 *
 * @apiBody {Number} [quantity=1] Quantidade de códigos a serem gerados (Opcional, 1-20).
 *
 * @apiSuccess {String} message Mensagem de sucesso.
 * @apiSuccess {String[]} codes Array com os códigos gerados.
 * @apiSuccess {Object[]} [failures] Array de falhas (se houver).
 *
 * @apiSuccessExample {json} Sucesso (201 Created):
 * HTTP/1.1 201 Created
 * {
 * "message": "2 código(s) de convite gerado(s) com sucesso.",
 * "codes": [
 * "a1b2c3d4e5f6a1b2c3d4e5f6",
 * "f6e5d4c3b2a1f6e5d4c3b2a1"
 * ]
 * }
 *
 * @apiError (Erro 400) BadRequest Quantidade inválida.
 * @apiError (Erro 401) Unauthorized Admin não autenticado.
 * @apiError (Erro 403) Forbidden Usuário não é admin.
 * @apiError (Erro 500) InternalServerError Erro ao gerar/salvar códigos.
 */
router.post(
    '/invite-codes',
    generateInviteCodeValidationRules(), // Validação (opcional para quantity)
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
 *
 * @apiHeader {String} Authorization Token JWT de acesso do Admin ("Bearer eyJhbGci...").
 *
 * @apiBody {String} username Nome de usuário único para a nova conta.
 * @apiBody {String} password Senha para a nova conta.
 * @apiBody {String} [role='user'] Papel a ser atribuído (ex: 'user', 'admin', 'moderator'). Opcional, padrão 'user'.
 *
 * @apiSuccess {String} message Mensagem de sucesso.
 * @apiSuccess {Number} userId ID do novo usuário.
 * @apiSuccess {String} username Nome de usuário criado.
 * @apiSuccess {String} role Papel atribuído.
 *
 * @apiSuccessExample {json} Sucesso (201 Created):
 * HTTP/1.1 201 Created
 * {
 * "message": "Usuário criado com sucesso pelo administrador!",
 * "userId": 6,
 * "username": "novo_moderador",
 * "role": "moderator"
 * }
 *
 * @apiError (Erro 400) BadRequest Dados inválidos (campos faltando, role inválido).
 * @apiError (Erro 401) Unauthorized Admin não autenticado.
 * @apiError (Erro 403) Forbidden Usuário não é admin.
 * @apiError (Erro 409) Conflict Nome de usuário já existe.
 * @apiError (Erro 500) InternalServerError Erro interno no servidor.
 */
router.post(
    '/users',
    createUserByAdminValidationRules(), // Novas regras de validação
    handleValidationErrors,
    adminController.createUserByAdmin
);

// TODO (Opcional): Adicionar rotas para listar/deletar códigos de convite
// GET /api/admin/invite-codes
// DELETE /api/admin/invite-codes/:code

module.exports = router;