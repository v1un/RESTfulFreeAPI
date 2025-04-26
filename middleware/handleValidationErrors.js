// middleware/handleValidationErrors.js
const { validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.warn('[Validation] Erros de validação encontrados:', errors.array());
        // Retorna apenas a primeira mensagem de erro para simplicidade,
        // ou pode retornar errors.array() para detalhes completos.
        return res.status(400).json({ message: errors.array()[0].msg });
        // Alternativa: retornar todos os erros
        // return res.status(400).json({ errors: errors.array() });
    }
    next(); // Sem erros, prossegue para o próximo middleware/controller
};

module.exports = handleValidationErrors;