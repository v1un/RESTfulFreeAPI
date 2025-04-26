// server.js

const path = require('path');
const dotenv = require('dotenv');

const envPath = path.resolve(__dirname, '.env');
const dotEnvResult = dotenv.config({ path: envPath });

if (dotEnvResult.error) {
    console.warn(`[dotenv] ALERTA: Não foi possível carregar o arquivo .env do caminho ${envPath}. Verifique se ele existe e tem permissões. Erro: ${dotEnvResult.error.message}`);
    console.warn('[dotenv] A aplicação continuará, esperando que as variáveis de ambiente estejam definidas externamente (ex: no Render).');
} else {
    console.info('[dotenv] Arquivo .env encontrado e processado.');
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet'); // Importação do Helmet
const rateLimit = require('express-rate-limit');
const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middlewares Globais de Segurança e Configuração ---

// 1. Helmet: Ajustado para permitir 'unsafe-eval' nos scripts (necessário para apiDoc)
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                ...helmet.contentSecurityPolicy.getDefaultDirectives(), // Começa com os padrões do Helmet
                "script-src": ["'self'", "'unsafe-eval'"], // Permite scripts da mesma origem E 'unsafe-eval'
                // Nota: Se apiDoc usasse CDNs ou outros scripts externos, precisaríamos adicioná-los aqui também.
            },
        },
        // Desabilitar outros headers se causarem problemas (improvável aqui)
        // crossOriginEmbedderPolicy: false,
        // crossOriginOpenerPolicy: false,
    })
);
console.info('[Segurança] Middleware Helmet aplicado (CSP ajustado para apiDoc).');


// 2. CORS: Habilita Cross-Origin Resource Sharing
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(',')
    : [];
console.info(`[CORS] Configurando origens permitidas: ${allowedOrigins.length > 0 ? allowedOrigins.join(', ') : '(Nenhuma - pode bloquear frontends!)'}`);
const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`[CORS] Bloqueada origem não permitida: ${origin}`);
            callback(new Error('Não permitido por CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// 3. Body Parsers: Para parsear JSON e urlencoded
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 4. Rate Limiter: Protege contra força bruta e abuso
const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '15') * 60 * 1000;
const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100');
console.info(`[Rate Limit] Configurado: ${maxRequests} reqs / ${windowMs / 60000} min por IP.`);
const limiter = rateLimit({
    windowMs: windowMs,
    max: maxRequests,
    message: 'Muitas requisições originadas deste IP, por favor tente novamente mais tarde.',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => { return req.ip; },
    handler: (req, res, next, options) => {
        console.warn(`[Rate Limit] Limite atingido para IP ${req.ip} na rota ${req.originalUrl}`);
        res.status(options.statusCode).json({ message: options.message });
    }
});
app.use(limiter);

// Middleware de Log de Requisição
app.use((req, res, next) => {
    console.log(`[Request] ${req.method} ${req.originalUrl} (IP: ${req.ip})`);
    next();
});


// --- Servir Documentação Estática (apiDoc) ---
const docsPath = path.join(__dirname, 'public', 'apidoc');
app.use('/docs', express.static(docsPath));
console.info(`[apiDoc] Documentação será servida em /docs (gere com 'npm run docs')`);


// --- Rotas da API ---
app.get('/', (req, res) => {
    res.status(200).json({ message: 'API de Autenticação Online!', version: '1.1.0' });
});
app.use('/api/auth', authRoutes);


// --- Tratamento de Erros ---
// 404 Handler
app.use((req, res, next) => {
    if (req.originalUrl.startsWith('/docs')) {
        return next();
    }
    res.status(404).json({ message: `Rota não encontrada: ${req.originalUrl}` });
});

// Error Handler Genérico
app.use((err, req, res, next) => {
    console.error(`[Erro Não Tratado] ${req.method} ${req.originalUrl} - ${err.message}`);
    console.error(err.stack || err);

    if (err.message === 'Não permitido por CORS') {
        return res.status(403).json({ message: 'Origem não permitida por CORS.' });
    }

    const statusCode = err.statusCode || 500;
    const message = process.env.NODE_ENV === 'production' && statusCode === 500
        ? 'Ocorreu um erro inesperado no servidor.'
        : err.message || 'Erro interno no servidor.';

    if (!res.headersSent) {
        res.status(statusCode).json({ message });
    }
});


// --- Inicialização do Servidor ---
app.listen(PORT, () => {
    console.log('-------------------------------------------------------');
    console.log(`✅ Servidor da API iniciado com sucesso!`);
    console.log(`🚀 Escutando em: http://localhost:${PORT}`);
    console.log(`📚 Docs API (apiDoc) em: http://localhost:${PORT}/docs`);
    console.log(`🌱 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log('-------------------------------------------------------');
    // Alertas de segurança JWT
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'seu_segredo_super_secreto_e_longo_aqui_troque_isso') {
        console.warn("⚠️ ALERTA DE SEGURANÇA: JWT_SECRET não está definido ou está usando o valor padrão! Defina uma chave secreta forte.");
    }
    if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET === 'outro_segredo_diferente_super_secreto_e_longo_aqui') {
        console.warn("⚠️ ALERTA DE SEGURANÇA: JWT_REFRESH_SECRET não está definido ou está usando o valor padrão! Defina uma chave secreta forte e diferente.");
    }
});