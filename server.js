const path = require('path'); // Módulo 'path' do Node para lidar com caminhos de arquivo
const dotenv = require('dotenv');

// Constrói o caminho absoluto para o arquivo .env na pasta raiz do projeto
const envPath = path.resolve(__dirname, '.env');

// Tenta carregar o .env do caminho específico e habilita debug se a variável DEBUG estiver definida
const dotEnvResult = dotenv.config({ path: envPath, debug: process.env.DEBUG === 'dotenv' });

// Verifica se houve erro ao carregar o .env
if (dotEnvResult.error) {
    console.error("ERRO FATAL: Falha ao carregar o arquivo .env.", dotEnvResult.error);
    // Considerar se deve sair ou não: process.exit(1);
    // Por enquanto, vamos apenas logar o erro e continuar,
    // pois as variáveis podem vir do ambiente de produção.
}

// Log para confirmar quais variáveis foram carregadas do arquivo .env (se alguma)
if (!dotEnvResult.error && dotEnvResult.parsed) {
    console.log('[dotenv] Variáveis carregadas com sucesso do .env:', Object.keys(dotEnvResult.parsed));
    // Descomente a linha abaixo para ver os VALORES (CUIDADO COM SENHAS NO LOG!)
    // console.log('[dotenv] Valores carregados:', dotEnvResult.parsed);
} else if (!dotEnvResult.error) {
    console.log('[dotenv] Arquivo .env encontrado, mas vazio ou sem variáveis parseadas.');
}

// server.js
const express = require('express');
const cors = require('cors'); // Importar cors
const helmet = require('helmet'); // Importar helmet
const rateLimit = require('express-rate-limit'); // Importar express-rate-limit

const authRoutes = require('./routes/authRoutes');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middlewares Globais de Segurança e Configuração ---

// 1. Helmet: Configura vários cabeçalhos HTTP para segurança básica
app.use(helmet());

// 2. CORS: Habilita Cross-Origin Resource Sharing
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(',')
    : []; // Pega origens do .env ou deixa vazio

console.log('[CORS] Origens permitidas:', allowedOrigins.length > 0 ? allowedOrigins : '(Nenhuma especificada, CORS pode bloquear)');

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

// Aplicar o rate limiter a todas as rotas (ou pode aplicar a rotas específicas)
app.use(limiter);
console.log(`[Rate Limit] Configurado: ${maxRequests} reqs por ${windowMs / 60000} min por IP.`);


// Middleware de log simples (como antes)
app.use((req, res, next) => {
    console.log(`[Request] ${new Date().toISOString()} - ${req.method} ${req.originalUrl} from IP: ${req.ip}`);
    next();
});


// --- Rotas ---
app.get('/', (req, res) => { /* ... (rota raiz como antes) ... */ });
app.use('/api/auth', authRoutes); // Rotas de autenticação

// --- Tratamento de Erros ---
// 404 Handler (como antes)
app.use((req, res, next) => { /* ... */ });
// Error Handler Genérico (como antes)
app.use((err, req, res, next) => {
    console.error("ERRO NÃO TRATADO:", err);

    // Tratamento específico para erro CORS
    if (err.message === 'Não permitido por CORS') {
        return res.status(403).json({ message: 'Origem não permitida por CORS.' });
    }

    const statusCode = err.statusCode || 500;
    const message = process.env.NODE_ENV === 'production' && statusCode === 500
        ? 'Ocorreu um erro interno no servidor.'
        : err.message || 'Erro interno.';

    res.status(statusCode).json({ message });
});


// --- Inicialização do Servidor ---
app.listen(PORT, () => { /* ... (logs de inicialização como antes) ... */ });