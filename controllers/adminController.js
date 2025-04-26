// controllers/adminController.js
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const db = require('../config/database');

const BCRYPT_SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10');

/**
 * Gera um ou mais códigos de convite.
 */
const generateInviteCodes = async (req, res) => {
    const adminUserId = req.user.id;
    const quantity = parseInt(req.body.quantity || '1') || 1;

    if (quantity <= 0 || quantity > 20) {
        return res.status(400).json({ message: "Quantidade inválida. Forneça um número entre 1 e 20." });
    }

    console.log(`[Admin] Admin ID ${adminUserId} solicitou a geração de ${quantity} código(s) de convite.`);
    const generatedCodes = [];
    const failedCodes = [];
    let attempts = 0;

    try {
        while (generatedCodes.length < quantity && attempts < quantity * 2) {
            attempts++;
            const code = crypto.randomBytes(12).toString('hex');
            try {
                const newCode = await db.addInviteCode(code, adminUserId);
                generatedCodes.push(newCode.code);
            } catch (error) {
                console.warn(`[Admin] Falha ao gerar/salvar código de convite (Tentativa ${attempts}): ${error.message}`);
                failedCodes.push({ attempt: attempts, error: error.message });
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
            failures: failedCodes.length > 0 ? failedCodes : undefined
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
    const adminUserId = req.user.id;
    const { username, password, role } = req.body;

    const allowedRoles = ['user', 'admin', 'moderator']; // Defina os papéis permitidos
    if (role && !allowedRoles.includes(role)) {
        return res.status(400).json({ message: `Papel (role) inválido. Papéis permitidos: ${allowedRoles.join(', ')}` });
    }

    console.log(`[Admin] Admin ID ${adminUserId} tentando criar usuário: ${username} com role: ${role || 'user'}`);

    try {
        const existingUser = await db.findUserByUsername(username);
        if (existingUser) {
            console.warn(`[Admin] Tentativa de criar usuário existente: ${username}`);
            return res.status(409).json({ message: 'Nome de usuário já está em uso.' });
        }

        const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
        const newUser = await db.addUser({ username, passwordHash, role: role || 'user' });

        console.log(`[Admin] Sucesso: Admin ID ${adminUserId} criou usuário ${username} (ID: ${newUser.id}, Role: ${newUser.role}).`);
        res.status(201).json({
            message: 'Usuário criado com sucesso pelo administrador!',
            userId: newUser.id,
            username: newUser.username,
            role: newUser.role
        });

    } catch (error) {
        if (error.message === 'Nome de usuário já existe.') {
            return res.status(409).json({ message: 'Nome de usuário já está em uso.' });
        }
        console.error(`[Admin] ERRO ao criar usuário ${username} pelo Admin ID ${adminUserId}:`, error);
        res.status(500).json({ message: 'Erro interno no servidor ao criar usuário.' });
    }
};


/**
 * Lista todos os usuários (requer role 'admin').
 */
const getAllUsers = async (req, res) => {
    // Admin já verificado pelos middlewares
    console.log(`[Admin] Admin ID ${req.user.id} solicitou a lista de usuários.`);
    try {
        const users = await db.findAllUsers();
        res.status(200).json(users); // Retorna o array de usuários
    } catch (error) {
        console.error(`[Admin] ERRO ao listar usuários (solicitado por Admin ID ${req.user.id}):`, error);
        res.status(500).json({ message: "Erro interno ao buscar usuários." });
    }
};

/**
 * Lista todos os códigos de convite (requer role 'admin').
 */
const getAllInviteCodes = async (req, res) => {
    // Admin já verificado pelos middlewares
    console.log(`[Admin] Admin ID ${req.user.id} solicitou a lista de códigos de convite.`);
    try {
        const codes = await db.findAllInviteCodes();
        // Opcional: Mapear/formatar os dados antes de enviar, ex: buscar usernames
        res.status(200).json(codes); // Retorna o array de códigos
    } catch (error) {
        console.error(`[Admin] ERRO ao listar códigos de convite (solicitado por Admin ID ${req.user.id}):`, error);
        res.status(500).json({ message: "Erro interno ao buscar códigos de convite." });
    }
};


module.exports = {
    generateInviteCodes,
    createUserByAdmin,
    getAllUsers, // <-- Exporta nova função
    getAllInviteCodes, // <-- Exporta nova função
};