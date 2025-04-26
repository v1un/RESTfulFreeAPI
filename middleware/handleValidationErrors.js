// middleware/handleValidationErrors.js
const { validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // Log interno dos erros detalhados para debug no servidor
        console.warn(`[Validation] Erros na requisição ${req.method} ${req.originalUrl}:`, errors.array());
        // Mensagem genérica ou o primeiro erro para o cliente
        // return res.status(400).json({ message: "Dados inválidos fornecidos." });
        // Ou retornar o primeiro erro:
        return res.status(400).json({ message: errors.array()[0].msg });
    }
    next(); // Sem erros, prossegue para o próximo middleware/controller
};

module.exports = handleValidationErrors;