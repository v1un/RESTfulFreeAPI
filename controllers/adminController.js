// controllers/adminController.js
const crypto = require('crypto'); // Para gerar códigos aleatórios seguros
const bcrypt = require('bcrypt');
const db = require('../config/database');

const BCRYPT_SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10');

/**
 * Gera um ou mais códigos de convite.
 */
const generateInviteCodes = async (req, res) => {
    // Admin já verificado pelos middlewares verifyAccessToken e verifyRoles('admin')
    const adminUserId = req.user.id; // ID do admin logado
    const quantity = parseInt(req.body.quantity || '1') || 1; // Quantidade de códigos a gerar (padrão 1)

    if (quantity <= 0 || quantity > 20) { // Limite para evitar abuso
        return res.status(400).json({ message: "Quantidade inválida. Forneça um número entre 1 e 20." });
    }

    console.log(`[Admin] Admin ID ${adminUserId} solicitou a geração de ${quantity} código(s) de convite.`);

    const generatedCodes = [];
    const failedCodes = [];
    let attempts = 0;

    try {
        while (generatedCodes.length < quantity && attempts < quantity * 2) { // Limite de tentativas
            attempts++;
            // Gera um código aleatório mais seguro (12 bytes -> 24 hex chars)
            const code = crypto.randomBytes(12).toString('hex');
            try {
                const newCode = await db.addInviteCode(code, adminUserId);
                generatedCodes.push(newCode.code); // Armazena apenas o código gerado
            } catch (error) {
                // Captura erro de código duplicado ou outro erro de DB
                console.warn(`[Admin] Falha ao gerar/salvar código de convite (Tentativa ${attempts}): ${error.message}`);
                failedCodes.push({ attempt: attempts, error: error.message });
                // Não para o loop, tenta gerar o próximo
            }
        }

        if (generatedCodes.length === 0) {
            console.error(`[Admin] Falha total ao gerar códigos para Admin ID ${adminUserId}.`);
            return res.status(500).json({ message: "Não foi possível gerar códigos de convite. Verifique os logs." });
        }

        console.log(`[Admin] Sucesso: ${generatedCodes.length} código(s) gerado(s) para Admin ID ${adminUserId}.`);
        res.status(201).json({
            message: `${generatedCodes.length} código(s) de convite gerado(s) com sucesso.`,
            codes: generatedCodes,
            failures: failedCodes.length > 0 ? failedCodes : undefined // Mostra falhas se houver
        });

    } catch (error) {
        console.error(`[Admin] ERRO GERAL ao gerar códigos para Admin ID ${adminUserId}:`, error);
        res.status(500).json({ message: "Erro interno no servidor ao gerar códigos." });
    }
};


/**
 * Cria um novo usuário diretamente pelo admin.
 */
const createUserByAdmin = async (req, res) => {
    // Admin já verificado pelos middlewares
    const adminUserId = req.user.id;
    // Validação de entrada feita pelo middleware na rota
    const { username, password, role } = req.body; // Admin pode definir o role

    // Valida o role (opcional mas recomendado)
    const allowedRoles = ['user', 'admin', 'moderator']; // Defina os papéis permitidos
    if (role && !allowedRoles.includes(role)) {
        return res.status(400).json({ message: `Papel (role) inválido. Papéis permitidos: ${allowedRoles.join(', ')}` });
    }

    console.log(`[Admin] Admin ID ${adminUserId} tentando criar usuário: ${username} com role: ${role || 'user'}`);

    try {
        // Verifica se o usuário já existe (boa prática, embora o DB pegue)
        const existingUser = await db.findUserByUsername(username);
        if (existingUser) {
            console.warn(`[Admin] Tentativa de criar usuário existente: ${username}`);
            return res.status(409).json({ message: 'Nome de usuário já está em uso.' });
        }

        // Gera hash da senha
        const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

        // Cria o usuário no DB especificando o role
        const newUser = await db.addUser({ username, passwordHash, role: role || 'user' }); // Passa role ou default 'user'

        console.log(`[Admin] Sucesso: Admin ID ${adminUserId} criou usuário ${username} (ID: ${newUser.id}, Role: ${newUser.role}).`);
        res.status(201).json({
            message: 'Usuário criado com sucesso pelo administrador!',
            userId: newUser.id,
            username: newUser.username,
            role: newUser.role
        });

    } catch (error) {
        // Tratamento de erro duplicado já está no addUser, mas podemos logar aqui também
        if (error.message === 'Nome de usuário já existe.') {
            return res.status(409).json({ message: 'Nome de usuário já está em uso.' });
        }
        console.error(`[Admin] ERRO ao criar usuário ${username} pelo Admin ID ${adminUserId}:`, error);
        res.status(500).json({ message: 'Erro interno no servidor ao criar usuário.' });
    }
};


module.exports = {
    generateInviteCodes,
    createUserByAdmin,
};