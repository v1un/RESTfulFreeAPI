// server.js

const path = require('path');
const dotenv = require('dotenv');

const envPath = path.resolve(__dirname, '.env');
const dotEnvResult = dotenv.config({ path: envPath }); // Debug removido da chamada direta

// Verifica APENAS se houve erro ao carregar o .env
if (dotEnvResult.error) {
    // Usamos console.warn pois a aplicação pode continuar se as vars vierem do ambiente
    console.warn(`[dotenv] ALERTA: Não foi possível carregar o arquivo .env do caminho ${envPath}. Verifique se ele existe e tem permissões. Erro: ${dotEnvResult.error.message}`);
    console.warn('[dotenv] A aplicação continuará, esperando que as variáveis de ambiente estejam definidas externamente (ex: no Render).');
} else {
    console.info('[dotenv] Arquivo .env encontrado e processado.'); // Log simples de sucesso
}

// ... resto das importações (express, cors, helmet, etc.) ...
const express = require('express');
// ... outras importações ...

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middlewares Globais ... ---

// Helmet
app.use(helmet());
console.info('[Segurança] Middleware Helmet aplicado.');

// CORS
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS ? process.env.CORS_ALLOWED_ORIGINS.split(',') : [];
console.info(`[CORS] Configurando origens permitidas: ${allowedOrigins.length > 0 ? allowedOrigins.join(', ') : '(Nenhuma - pode bloquear frontends!)'}`);
// ... (lógica corsOptions como antes) ...
app.use(cors(corsOptions));

// Body Parsers
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Rate Limiter
const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '15') * 60 * 1000;
const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100');
console.info(`[Rate Limit] Configurado: ${maxRequests} reqs / ${windowMs / 60000} min por IP.`);
const limiter = rateLimit({ /* ... opções como antes ... */ });
app.use(limiter);

// Middleware de Log de Requisição (mantido simples)
app.use((req, res, next) => {
    // Loga todas as requisições, incluindo health checks
    console.log(`[Request] ${req.method} ${req.originalUrl} (IP: ${req.ip})`);
    next();
});

// --- Rotas ---
app.get('/', (req, res) => {
    res.status(200).json({ message: 'API de Autenticação Online!', version: '1.0.0' });
});
app.use('/api/auth', authRoutes);

// --- Tratamento de Erros ---
// 404 Handler
app.use((req, res, next) => {
    res.status(404).json({ message: `Rota não encontrada: ${req.originalUrl}` });
});

// Error Handler Genérico
app.use((err, req, res, next) => {
    // Log do erro no servidor de forma mais detalhada
    console.error(`[Erro Não Tratado] ${req.method} ${req.originalUrl} - ${err.message}`);
    console.error(err.stack || err); // Log stack trace completo para debug

    if (err.message === 'Não permitido por CORS') {
        return res.status(403).json({ message: 'Origem não permitida por CORS.' });
    }

    const statusCode = err.statusCode || 500;
    // Mensagem mais genérica para erros 500 em produção
    const message = process.env.NODE_ENV === 'production' && statusCode === 500
        ? 'Ocorreu um erro inesperado no servidor.'
        : err.message || 'Erro interno no servidor.';

    res.status(statusCode).json({ message });
});

// --- Inicialização do Servidor ---
app.listen(PORT, () => {
    console.log('-------------------------------------------------------');
    console.log(`✅ Servidor da API iniciado com sucesso!`);
    console.log(`🚀 Escutando em: http://localhost:${PORT}`);
    console.log(`🌱 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log('-------------------------------------------------------');
    // Alerta de segurança para JWT_SECRET (mantido)
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'seu_segredo_super_secreto_e_longo_aqui_troque_isso') {
        console.warn("⚠️ ALERTA DE SEGURANÇA: JWT_SECRET não está definido ou está usando o valor padrão! Defina uma chave secreta forte.");
    }
    if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET === 'outro_segredo_diferente_super_secreto_e_longo_aqui') {
        console.warn("⚠️ ALERTA DE SEGURANÇA: JWT_REFRESH_SECRET não está definido ou está usando o valor padrão! Defina uma chave secreta forte e diferente.");
    }
});