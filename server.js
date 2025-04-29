// server.js

const path = require('path');
const dotenv = require('dotenv');

// Constrói o caminho absoluto para o arquivo .env na pasta raiz do projeto
const envPath = path.resolve(__dirname, '.env');

// Tenta carregar o .env do caminho específico
const dotEnvResult = dotenv.config({ path: envPath });

// Verifica APENAS se houve erro ao carregar o .env
if (dotEnvResult.error) {
    // Usamos console.warn pois a aplicação pode continuar se as vars vierem do ambiente
    console.warn(`[dotenv] ALERTA: Não foi possível carregar o arquivo .env do caminho ${envPath}. Verifique se ele existe e tem permissões. Erro: ${dotEnvResult.error.message}`);
    console.warn('[dotenv] A aplicação continuará, esperando que as variáveis de ambiente estejam definidas externamente (ex: no Render).');
} else {
    console.info('[dotenv] Arquivo .env encontrado e processado.'); // Log simples de sucesso
}

// Restante das importações DEPOIS do dotenv.config()
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./routes/authRoutes'); // Rotas de autenticação/usuário
const adminRoutes = require('./routes/adminRoutes'); // Rotas de administração
const aiRoutes = require('./routes/aiRoutes'); // Rotas de AI Chat

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middlewares Globais de Segurança e Configuração ---

// 1. Helmet: Configura vários cabeçalhos HTTP para segurança básica
app.use(helmet()); // Usando configuração padrão do Helmet por enquanto
console.info('[Segurança] Middleware Helmet aplicado.');

// 2. CORS: Habilita Cross-Origin Resource Sharing
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(',')
    : []; // Pega origens do .env ou deixa vazio

console.info(`[CORS] Configurando origens permitidas: ${allowedOrigins.length > 0 ? allowedOrigins.join(', ') : '(Nenhuma - pode bloquear frontends!)'}`);

const corsOptions = {
    origin: (origin, callback) => {
        // Permite requisições sem 'origin' (como Postman, curl, apps mobile) OU se a origem está na lista
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`[CORS] Bloqueada origem não permitida: ${origin}`);
            callback(new Error('Não permitido por CORS'));
        }
    },
    credentials: true, // Permite cookies/authorization headers (importante para tokens/sessões)
    optionsSuccessStatus: 200 // Para browsers legados
};
app.use(cors(corsOptions));

// 3. Body Parsers: Para parsear JSON e urlencoded
app.use(express.json({ limit: '10kb' })); // Limite no tamanho do payload JSON
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 4. Rate Limiter: Protege contra força bruta e abuso
const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '15') * 60 * 1000; // Janela em milissegundos
const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'); // Max requisições por janela por IP
console.info(`[Rate Limit] Configurado: ${maxRequests} reqs / ${windowMs / 60000} min por IP.`);

const limiter = rateLimit({
    windowMs: windowMs,
    max: maxRequests,
    message: 'Muitas requisições originadas deste IP, por favor tente novamente mais tarde.',
    standardHeaders: true, // Retorna info do limite nos headers `RateLimit-*`
    legacyHeaders: false, // Desabilita headers `X-RateLimit-*`
    keyGenerator: (req) => { // Usa IP como chave (padrão)
        return req.ip;
    },
    handler: (req, res, next, options) => { // Log quando o limite é atingido
        console.warn(`[Rate Limit] Limite atingido para IP ${req.ip} na rota ${req.originalUrl}`);
        res.status(options.statusCode).json({ message: options.message });
    }
});

// Aplicar o rate limiter a todas as rotas /api/* (mais específico)
app.use('/api', limiter); // Aplicado apenas às rotas da API

// Middleware de Log de Requisição
app.use((req, res, next) => {
    // Loga todas as requisições
    console.log(`[Request] ${req.method} ${req.originalUrl} (IP: ${req.ip})`);
    next();
});


// --- Rotas da API ---
// Rota raiz
app.get('/', (req, res) => {
    res.status(200).json({ message: 'API de Autenticação Online!', version: '1.1.0' });
});
// Rotas de autenticação PÚBLICAS e de USUÁRIO LOGADO
app.use('/api/auth', authRoutes);
// Rotas de ADMINISTRAÇÃO (protegidas internamente com middleware de role)
app.use('/api/admin', adminRoutes);

// Rotas de AI Chat
app.use('/api/ai', aiRoutes);

// --- Tratamento de Erros ---
// Middleware para tratar rotas não encontradas (404) - Deve vir depois das rotas da API
app.use((req, res, next) => {
    res.status(404).json({ message: `Endpoint não encontrado: ${req.originalUrl}` });
});

// Middleware genérico para tratamento de erros - Deve ser o último middleware
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    // Log do erro no servidor de forma mais detalhada
    console.error(`[Erro Não Tratado] ${req.method} ${req.originalUrl} - ${err.message}`);
    console.error(err.stack || err); // Log stack trace completo para debug

    // Tratamento específico para erro CORS
    if (err.message === 'Não permitido por CORS') {
        return res.status(403).json({ message: 'Origem não permitida por CORS.' });
    }

    const statusCode = err.statusCode || 500;
    // Mensagem mais genérica para erros 500 em produção
    const message = process.env.NODE_ENV === 'production' && statusCode === 500
        ? 'Ocorreu um erro inesperado no servidor.'
        : err.message || 'Erro interno no servidor.';

    // Garante que não tentará enviar uma resposta se os headers já foram enviados
    if (!res.headersSent) {
        res.status(statusCode).json({ message });
    }
});


// --- Inicialização do Servidor ---
app.listen(PORT, () => {
    console.log('-------------------------------------------------------');
    console.log(`✅ Servidor da API iniciado com sucesso!`);
    console.log(`🚀 Escutando em: http://localhost:${PORT}`);
    // Log da documentação removido
    console.log(`🌱 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log('-------------------------------------------------------');
    // Alerta de segurança para JWT_SECRET
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'seu_segredo_super_secreto_e_longo_aqui_troque_isso') {
        console.warn("⚠️ ALERTA DE SEGURANÇA: JWT_SECRET não está definido ou está usando o valor padrão! Defina uma chave secreta forte.");
    }
    // Alerta de segurança para JWT_REFRESH_SECRET
    if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET === 'outro_segredo_diferente_super_secreto_e_longo_aqui') {
        console.warn("⚠️ ALERTA DE SEGURANÇA: JWT_REFRESH_SECRET não está definido ou está usando o valor padrão! Defina uma chave secreta forte e diferente.");
    }
});