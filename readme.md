# API de Autenticação Robusta (Node.js + PostgreSQL)

![Node.js](https://img.shields.io/badge/Node.js-LTS-green?style=for-the-badge&logo=node.js)
![Express.js](https://img.shields.io/badge/Express.js-4.x-blue?style=for-the-badge&logo=express)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-blue?style=for-the-badge&logo=postgresql)
![JWT](https://img.shields.io/badge/JWT-Auth-orange?style=for-the-badge&logo=jsonwebtokens)
![License](https://img.shields.io/badge/License-ISC-yellow?style=for-the-badge)

API RESTful completa para autenticação e gerenciamento de usuários, construída com Node.js, Express e PostgreSQL (otimizada para Neon). Inclui JWT para autenticação (Access + Refresh Tokens), hashing de senhas com bcrypt, validação de entrada, rate limiting, CORS, headers de segurança com Helmet e suporte básico a papéis (Roles).

## ✨ Features Principais

* **Autenticação Baseada em JWT:**
    * Tokens de Acesso (Access Tokens) de curta duração.
    * Tokens de Atualização (Refresh Tokens) de longa duração com invalidação via blacklist.
    * Geração de tokens segura com segredos distintos.
* **Gerenciamento de Usuário:**
    * Registro de novos usuários (com validação e hashing de senha).
    * Login de usuários existentes.
    * Endpoint de Logout (invalida o Refresh Token).
    * Endpoint para obter um novo Access Token usando o Refresh Token.
    * Endpoint protegido de exemplo para buscar perfil do usuário.
* **Segurança:**
    * Hashing de senhas com `bcrypt`.
    * Validação de dados de entrada com `express-validator`.
    * Rate Limiting com `express-rate-limit` para prevenir força bruta.
    * Headers de segurança HTTP configurados com `helmet`.
    * Configuração de CORS (`cors`) para permitir acesso controlado do frontend.
    * JWT ID (`jti`) em Refresh Tokens para permitir invalidação individual.
* **Papéis (Roles):**
    * Estrutura básica para papéis de usuário (ex: 'user', 'admin').
    * Middleware `verifyRoles` para proteger rotas baseadas em papéis.
    * Mecanismo seguro para criação de usuário Admin via script.
* **Documentação:**
    * Documentação interativa da API disponível via Swagger UI (`/api-docs`).

## 💻 Tecnologias Utilizadas

* **Backend:** Node.js
* **Framework:** Express.js
* **Banco de Dados:** PostgreSQL (configurado para Neon.tech, mas adaptável)
* **Autenticação:** JSON Web Tokens (`jsonwebtoken`), `bcrypt`
* **Validação:** `express-validator`
* **Segurança:** `helmet`, `cors`, `express-rate-limit`
* **Geração de ID:** `uuid`
* **Driver DB:** `pg` (node-postgres)
* **Variáveis de Ambiente:** `dotenv` (para desenvolvimento local)

## 🚀 Pré-requisitos

* Node.js (Versão LTS recomendada, definida em `package.json` -> `engines`)
* npm (geralmente vem com Node.js)
* Git (para clonar o repositório)
* Acesso a um servidor PostgreSQL (Ex: Conta gratuita no [Neon.tech](https://neon.tech/))

## ⚙️ Configuração e Instalação

1.  **Clone o Repositório:**
    ```bash
    git clone <URL_DO_SEU_REPOSITORIO>
    cd <NOME_DA_PASTA_DO_PROJETO>
    ```

2.  **Instale as Dependências:**
    ```bash
    npm install
    ```

3.  **Configure as Variáveis de Ambiente:**
    * Copie o arquivo `.env.example` para um novo arquivo chamado `.env`:
        ```bash
        # No Linux/macOS/Git Bash
        cp .env.example .env
        # No Windows CMD
        copy .env.example .env
        ```
    * **Edite o arquivo `.env`** e preencha **TODAS** as variáveis com seus próprios valores:
        * `PORT`: Porta para rodar localmente (ex: 3000).
        * `JWT_SECRET`: Segredo FORTE e ÚNICO para Access Tokens.
        * `JWT_EXPIRES_IN`: Tempo de expiração do Access Token (ex: `15m`).
        * `JWT_REFRESH_SECRET`: Segredo FORTE, ÚNICO e **DIFERENTE** do `JWT_SECRET` para Refresh Tokens.
        * `JWT_REFRESH_EXPIRES_IN`: Tempo de expiração do Refresh Token (ex: `7d`).
        * `BCRYPT_SALT_ROUNDS`: Custo do Hashing (padrão 10 é bom).
        * `DATABASE_URL`: A **URL de conexão completa** do seu banco de dados PostgreSQL (Ex: A "Pooled connection string" do Neon).
        * `RATE_LIMIT_WINDOW_MS`: Janela do Rate Limiter em minutos (ex: 15).
        * `RATE_LIMIT_MAX_REQUESTS`: Nº máximo de requisições na janela por IP (ex: 100).
        * `CORS_ALLOWED_ORIGINS`: URLs do seu frontend (separadas por vírgula, ex: `http://localhost:3001,https://seufrontend.com`).
        * `ADMIN_USERNAME` (Opcional, para script seed): Usuário do admin inicial.
        * `ADMIN_PASSWORD` (Opcional, para script seed): Senha do admin inicial.

4.  **Configure o Banco de Dados:**
    * Conecte-se ao seu banco de dados PostgreSQL (usando o SQL Editor do Neon ou outra ferramenta).
    * Execute o SQL para criar a tabela `users` (encontrado em `docs/schema.sql` ou executado manualmente):
        ```sql
        CREATE TABLE users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(255) UNIQUE NOT NULL,
            "passwordHash" TEXT NOT NULL,
            "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
        -- Adiciona a coluna 'role' (se ainda não existir)
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS "role" VARCHAR(50) NOT NULL DEFAULT 'user';

        -- Cria índice (opcional, mas recomendado)
        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
        ```
    * *Nota: O `ALTER TABLE` pode ser executado mesmo se a coluna já existir (usando `IF NOT EXISTS`).*

5.  **Crie o Usuário Admin (Opcional, mas Recomendado):**
    * Certifique-se que `ADMIN_USERNAME` and `ADMIN_PASSWORD` estão definidos no seu arquivo `.env`.
    * Execute o script para criar o usuário admin no banco:
        ```bash
        npm run seed:admin
        ```
    * Este comando só precisa ser executado uma vez.

## ▶️ Rodando a API

* **Desenvolvimento Local (com Nodemon para auto-reload):**
    ```bash
    npm run dev
    ```
  A API estará disponível em `http://localhost:PORT` (onde `PORT` é o valor definido no `.env`).

* **Produção:**
    ```bash
    npm start
    ```
  Use um gerenciador de processos como PM2 em ambientes de produção reais fora de plataformas como Render.

## <caption> API Endpoints

Uma visão geral. Para detalhes completos, parâmetros e respostas, acesse a **documentação interativa** da API.

* `GET /`: Verifica se a API está online.
* `POST /api/auth/register`: Registra um novo usuário (sempre com role 'user').
* `POST /api/auth/login`: Autentica um usuário e retorna Access/Refresh tokens.
* `POST /api/auth/refresh`: Obtém um novo Access Token usando um Refresh Token válido.
* `POST /api/auth/logout`: Invalida o Refresh Token fornecido (adiciona à blacklist).
* `GET /api/auth/profile`: (Protegido) Retorna informações do usuário logado.
* `GET /api/auth/admin-only`: (Protegido - Role 'admin') Exemplo de rota restrita a admins.
* `GET /api/auth/staff-area`: (Protegido - Role 'admin' ou 'moderator') Exemplo de rota restrita a múltiplos papéis.

**Documentação Interativa (Swagger):**

Após iniciar a API, acesse: `http://localhost:PORT/api-docs`

## 🧪 Testando

* Use ferramentas como [Postman](https://www.postman.com/), [Insomnia](https://insomnia.rest/) ou `curl` para fazer requisições aos endpoints.
* Exemplos de `curl` podem ser encontrados nas respostas anteriores ou adaptados facilmente. Lembre-se de incluir o `Content-Type: application/json` para requisições `POST` e o header `Authorization: Bearer <seu_access_token>` para rotas protegidas.

## 🚀 Deploy (Ex: Render.com)

1.  Faça o commit do seu código para um repositório Git (GitHub, GitLab). **NÃO** inclua o arquivo `.env` no commit (ele deve estar no `.gitignore`).
2.  Crie um "Web Service" no Render e conecte-o ao seu repositório.
3.  **Configurações no Render:**
    * **Build Command:** `npm install` (geralmente detectado automaticamente)
    * **Start Command:** `npm start` (detectado pelo script `start` no `package.json`)
    * **Environment Variables:** Configure **TODAS** as variáveis de ambiente necessárias (listadas na seção de configuração `.env`) diretamente no painel do Render. Use valores fortes e únicos para os segredos JWT!
4.  O Render fará o build e deploy automaticamente.

## 🤝 Contribuição

Contribuições são bem-vindas (se aplicável). Por favor, siga as boas práticas de desenvolvimento.

## 📄 Licença

Este projeto está licenciado sob a Licença ISC. Veja o arquivo `LICENSE` (se existir) para detalhes.

---
*Gerado por Marquin - Engenheiro de Software Sênior*