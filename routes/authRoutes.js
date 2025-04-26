// routes/authRoutes.js
const express = require('express');
const authController = require('../controllers/authController');
// Se tivéssemos validação de schema, importaríamos aqui:
// const { validateRegistration, validateLogin } = require('../middleware/validationMiddleware');

const router = express.Router();

// Rota para registro de novo usuário
// POST /api/auth/register
// Corpo esperado: { "username": "...", "password": "..." }
router.post('/register', /* validateRegistration (opcional) ,*/ authController.registerUser);

// Rota para login de usuário existente
// POST /api/auth/login
// Corpo esperado: { "username": "...", "password": "..." }
router.post('/login', /* validateLogin (opcional) ,*/ authController.loginUser);

// Exemplo de uma rota protegida (requer token válido)
// GET /api/auth/profile (Exemplo)
// Header esperado: Authorization: Bearer <seu_token_jwt>
/*
const { verifyToken } = require('../middleware/authMiddleware');
router.get('/profile', verifyToken, (req, res) => {
    // Graças ao middleware verifyToken, req.user contém os dados do token decodificado
    res.status(200).json({
        message: "Dados do perfil acessados com sucesso.",
        user: req.user // Contém { id, username, iat, exp, ... }
    });
});
*/

module.exports = router;