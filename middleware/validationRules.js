// middleware/validationRules.js
const { body } = require('express-validator');

const registerValidationRules = () => {
    return [
        body('username')
            .trim()
            .notEmpty().withMessage('Nome de usuário é obrigatório.')
            .isLength({ min: 3 }).withMessage('Nome de usuário deve ter pelo menos 3 caracteres.'),

        body('password')
            .notEmpty().withMessage('Senha é obrigatória.')
            .isLength({ min: 6 }).withMessage('Senha deve ter pelo menos 6 caracteres.')
        // Poderia adicionar regras mais complexas aqui (ex: .isStrongPassword())
    ];
};

const loginValidationRules = () => {
    return [
        body('username')
            .trim()
            .notEmpty().withMessage('Nome de usuário é obrigatório.'),

        body('password')
            .notEmpty().withMessage('Senha é obrigatória.'),
    ];
};

const refreshTokenValidationRules = () => {
    return [
        body('refreshToken')
            .notEmpty().withMessage('Refresh token é obrigatório.')
            .isJWT().withMessage('Formato de refresh token inválido.')
    ];
};

module.exports = {
    registerValidationRules,
    loginValidationRules,
    refreshTokenValidationRules,
};