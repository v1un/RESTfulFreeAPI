﻿// config/tokenBlacklist.js

/**
 * ATENÇÃO: Implementação de blacklist de tokens em memória.
 * NÃO É PERSISTENTE e NÃO FUNCIONA em ambientes com múltiplos processos/servidores.
 * Adequado APENAS para demonstração ou desenvolvimento local.
 * Para produção, use uma solução persistente como Redis ou uma tabela no banco de dados.
 */

// Usamos um Set para armazenamento eficiente e verificação rápida de existência.
const blacklistedTokens = new Set();

/**
 * Adiciona um token (JTI - JWT ID) à blacklist.
 * @param {string} jti - O ID único do token JWT a ser invalidado.
 */
function addToBlacklist(jti) {
    if (jti) {
        // console.log(`[Blacklist] Adicionando JTI: ${jti}`); // Log comentado por padrão
        blacklistedTokens.add(jti);
    }
}

/**
 * Verifica se um token (JTI) está na blacklist.
 * @param {string} jti - O ID do token JWT a ser verificado.
 * @returns {boolean} True se o token estiver na blacklist, false caso contrário.
 */
function isBlacklisted(jti) {
    const blacklisted = jti ? blacklistedTokens.has(jti) : false;
    // Só loga se realmente estiver na blacklist, pois é um evento de segurança relevante
    if (blacklisted) {
        console.warn(`[Blacklist] ATENÇÃO: JTI ${jti} está na blacklist (token revogado).`);
    }
    return blacklisted;
}

// Opcional: Limpeza periódica de tokens expirados (simplificado)
// Em uma implementação real com tempos de expiração, você removeria JTIs
// cujo 'exp' correspondente já passou. Este exemplo não faz isso automaticamente.
// setInterval(() => { /* Lógica de limpeza */ }, SOME_INTERVAL);

module.exports = {
    addToBlacklist,
    isBlacklisted,
};