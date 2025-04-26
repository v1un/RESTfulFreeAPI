// server.js
const express = require('express');
const dotenv = require('dotenv');
const authRoutes = require('./routes/authRoutes');
// Poderíamos adicionar outros arquivos de rotas aqui, ex: const userRoutes = require('./routes/userRoutes');

// Carrega variáveis de ambiente do arquivo .env.example
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000; // Usa a porta do .env.example ou 3000 como padrão

// --- Middlewares Globais ---

// Middleware para parsear JSON no corpo das requisições
app.use(express.json());

// Middleware para parsear dados de formulário urlencoded (opcional, mas comum)
app.use(express.urlencoded({ extended: true }));

// Middleware de log simples para cada requisição (exemplo)
app.use((req, res, next) => {
    console.log(`[Request] ${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
    next();
});

// --- Rotas ---

// Rota raiz simples para verificar se a API está online
app.get('/', (req, res) => {
    res.status(200).json({ message: 'API de Autenticação está online!', version: '1.0.0' });
});

// Monta as rotas de autenticação no prefixo /api/auth
app.use('/api/auth', authRoutes);

// Montar outras rotas aqui, se houver
// app.use('/api/users', userRoutes); // Exemplo

// --- Tratamento de Erros ---

// Middleware para tratar rotas não encontradas (404) - Deve vir depois das rotas
app.use((req, res, next) => {
    res.status(404).json({ message: 'Rota não encontrada.' });
});

// Middleware genérico para tratamento de erros - Deve ser o último middleware
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error("ERRO NÃO TRATADO:", err);
    // Evite vazar detalhes do erro em produção
    const statusCode = err.statusCode || 500; // Usa o status code do erro ou 500 padrão
    const message = process.env.NODE_ENV === 'production' ? 'Ocorreu um erro interno no servidor.' : err.message;

    res.status(statusCode).json({
        message: message,
        // stack: process.env.NODE_ENV === 'development' ? err.stack : undefined // Opcional: mostrar stack em dev
    });
});


// --- Inicialização do Servidor ---
app.listen(PORT, () => {
    console.log(`-------------------------------------------------------`);
    console.log(`🚀 Servidor da API de Autenticação iniciado`);
    console.log(`👂 Escutando na porta ${PORT}`);
    console.log(`🔗 URL base: http://localhost:${PORT}`);
    console.log(`🌱 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`-------------------------------------------------------`);
    // Verifica se o JWT_SECRET foi carregado (já verificado nos módulos, mas bom ter um log aqui)
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'seu_segredo_super_secreto_e_longo_aqui_troque_isso') {
        console.warn("⚠️  ALERTA DE SEGURANÇA: JWT_SECRET não está definido ou está usando o valor padrão! Defina uma chave secreta forte no arquivo .env.example");
    }
});