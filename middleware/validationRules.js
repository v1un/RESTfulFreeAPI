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
            .isLength({ min: 6 }).withMessage('Senha deve ter pelo menos 6 caracteres.'),

        // Nova regra: Código de convite é obrigatório
        body('inviteCode')
            .trim()
            .notEmpty().withMessage('Código de convite (inviteCode) é obrigatório.')
            .isLength({ min: 10 }).withMessage('Código de convite inválido.'), // Ajuste o minLength se necessário
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

// Novas regras para Admin criando usuário
const createUserByAdminValidationRules = () => {
    return [
        body('username')
            .trim()
            .notEmpty().withMessage('Nome de usuário é obrigatório.')
            .isLength({ min: 3 }).withMessage('Nome de usuário deve ter pelo menos 3 caracteres.'),

        body('password')
            .notEmpty().withMessage('Senha é obrigatória.')
            .isLength({ min: 6 }).withMessage('Senha deve ter pelo menos 6 caracteres.'),

        // Validação opcional do 'role' (permite string, a lógica do controller valida os valores)
        body('role')
            .optional()
            .isString().withMessage('Papel (role) deve ser uma string.')
            .trim()
            .notEmpty().withMessage('Papel (role) não pode ser vazio se fornecido.'),
    ];
};

// Novas regras para geração de código de convite
const generateInviteCodeValidationRules = () => {
    return [
        // Validação opcional da quantidade
        body('quantity')
            .optional()
            .isInt({ min: 1, max: 20 }).withMessage('Quantidade deve ser um número entre 1 e 20.')
            .toInt() // Converte para inteiro
    ];
};


module.exports = {
    registerValidationRules,
    loginValidationRules,
    refreshTokenValidationRules,
    createUserByAdminValidationRules, // Exporta nova regra
    generateInviteCodeValidationRules, // Exporta nova regra
};