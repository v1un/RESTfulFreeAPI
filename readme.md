# API de Autenticação Robusta (Node.js + PostgreSQL)

![Node.js](https://img.shields.io/badge/Node.js-LTS-green?style=for-the-badge&logo=node.js)
![Express.js](https://img.shields.io/badge/Express.js-4.x-blue?style=for-the-badge&logo=express)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-blue?style=for-the-badge&logo=postgresql)
![JWT](https://img.shields.io/badge/JWT-Auth-orange?style=for-the-badge&logo=jsonwebtokens)
![License](https://img.shields.io/badge/License-ISC-yellow?style=for-the-badge)

API RESTful completa para autenticação e gerenciamento de usuários, construída com Node.js, Express e PostgreSQL (otimizada para Neon). Inclui JWT para autenticação (Access + Refresh Tokens), hashing de senhas com bcrypt, validação de entrada, rate limiting, CORS, headers de segurança com Helmet, suporte básico a papéis (Roles) e **registro controlado por código de convite ou criação direta por admin**.

## ✨ Features Principais

* **Autenticação Baseada em JWT:**
    * Tokens de Acesso (Access Tokens) de curta duração.
    * Tokens de Atualização (Refresh Tokens) de longa duração com invalidação via blacklist (`/logout`).
    * Geração de tokens segura com segredos distintos.
    * Endpoint para obter um novo Access Token usando o Refresh Token (`/refresh`).
* **Gerenciamento de Usuário Controlado:**
    * **Registro Público via Convite:** Novos usuários só podem se registrar fornecendo um código de convite (`inviteCode`) válido e não utilizado (`/register`).
    * **Geração de Convites por Admin:** Endpoint para administradores gerarem códigos de convite únicos (`/admin/invite-codes`).
    * **Criação Direta por Admin:** Endpoint para administradores criarem contas de usuário diretamente, podendo definir o papel (`/admin/users`).
    * Endpoint protegido de exemplo para buscar perfil do usuário logado (`/profile`).
* **Segurança:**
    * Hashing de senhas com `bcrypt`.
    * Validação de dados de entrada com `express-validator`.
    * Rate Limiting com `express-rate-limit` para prevenir força bruta.
    * Headers de segurança HTTP configurados com `helmet`.
    * Configuração de CORS (`cors`) para permitir acesso controlado do frontend.
    * JWT ID (`jti`) em Refresh Tokens para permitir invalidação individual.
* **Papéis (Roles):**
    * Estrutura básica para papéis de usuário (ex: 'user', 'admin', 'moderator').
    * Middleware `verifyRoles` para proteger rotas baseadas em papéis.
    * Mecanismo seguro para criação de usuário Admin inicial via script (`npm run seed:admin`).
* **Documentação:**
    * Documentação interativa da API gerada via `apiDocJS` e disponível em `/docs`.

## 💻 Tecnologias Utilizadas

* **Backend:** Node.js
* **Framework:** Express.js
* **Banco de Dados:** PostgreSQL (configurado para Neon.tech, mas adaptável)
* **Autenticação:** JSON Web Tokens (`jsonwebtoken`), `bcrypt`
* **Validação:** `express-validator`
* **Segurança:** `helmet`, `cors`, `express-rate-limit`
* **Geração de ID/Códigos:** `uuid`, `crypto` (Node.js built-in)
* **Driver DB:** `pg` (node-postgres)
* **Variáveis de Ambiente:** `dotenv` (para desenvolvimento local)
* **Documentação:** `apidoc`

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
    * Copie o arquivo `.env.example` para um novo arquivo chamado `.env`.
    * **Edite o arquivo `.env`** e preencha **TODAS** as variáveis com seus próprios valores (veja `.env.example` para a lista completa e descrições). Preste atenção especial a:
        * `JWT_SECRET` e `JWT_REFRESH_SECRET` (devem ser fortes, únicos e diferentes entre si).
        * `DATABASE_URL` (URL de conexão completa do seu PostgreSQL).
        * `CORS_ALLOWED_ORIGINS` (URLs do seu frontend).
        * `ADMIN_USERNAME` e `ADMIN_PASSWORD` (credenciais para o script de criação do admin inicial).

4.  **Configure o Banco de Dados:**
    * Conecte-se ao seu banco de dados PostgreSQL.
    * Execute os seguintes comandos SQL na ordem correta para criar as tabelas e índices necessários:

        ```sql
        -- 1. Cria a tabela de usuários
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(255) UNIQUE NOT NULL,
            "passwordHash" TEXT NOT NULL,
            "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
        );

        -- 2. Adiciona a coluna 'role' à tabela 'users' (se ainda não existir)
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS "role" VARCHAR(50) NOT NULL DEFAULT 'user';

        -- 3. Cria a tabela de códigos de convite
        CREATE TABLE IF NOT EXISTS invite_codes (
            id SERIAL PRIMARY KEY,
            code VARCHAR(64) UNIQUE NOT NULL,
            is_used BOOLEAN DEFAULT false NOT NULL,
            created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            used_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
            used_at TIMESTAMPTZ NULL
        );

        -- 4. Cria índices (se ainda não existirem)
        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
        CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);
        ```
    * *Nota: O uso de `IF NOT EXISTS` torna os comandos seguros para serem executados múltiplas vezes, mas a ordem ainda é importante para as referências (`REFERENCES users(id)`).*

5.  **Crie o Usuário Admin Inicial:**
    * Certifique-se que `ADMIN_USERNAME` e `ADMIN_PASSWORD` estão definidos no seu arquivo `.env`.
    * Execute o script para criar o usuário admin no banco:
        ```bash
        npm run seed:admin
        ```
    * Este comando só precisa ser executado uma vez (ele verifica se o admin já existe).

6.  **Gere a Documentação Inicial:**
    ```bash
    npm run docs
    ```
    (Você precisará rodar isso novamente se modificar os comentários `@api` nas rotas).

## ▶️ Rodando a API

* **Desenvolvimento Local (com Nodemon para auto-reload):**
    ```bash
    npm run dev
    ```
  A API estará disponível em `http://localhost:PORT` e a documentação em `http://localhost:PORT/docs`.

* **Produção:**
    ```bash
    npm start
    ```
  Lembre-se que o script `start` agora também executa o `seed:admin` (de forma segura) antes de iniciar o servidor. Use um gerenciador de processos como PM2 em ambientes de produção reais fora de plataformas como Render.

## <caption> API Endpoints

Uma visão geral. Para detalhes completos, parâmetros e respostas, acesse a **documentação** em `/docs`.

* `GET /`: Verifica se a API está online.

**Autenticação (`/api/auth`)**
* `POST /register`: Registra um novo usuário **usando um `inviteCode` válido**.
* `POST /login`: Autentica um usuário e retorna Access/Refresh tokens.
* `POST /refresh`: Obtém um novo Access Token usando um Refresh Token válido.
* `POST /logout`: Invalida o Refresh Token fornecido (adiciona à blacklist).

**Usuário (`/api/auth`)**
* `GET /profile`: (Protegido) Retorna informações do usuário logado.

**Administração (`/api/admin`)** - Requer Role 'admin'
* `POST /invite-codes`: Gera um ou mais códigos de convite.
* `POST /users`: Cria um novo usuário diretamente (pode definir role).
* `GET /admin-only`: (Protegido - Role 'admin') Exemplo de rota restrita a admins.
* `GET /staff-area`: (Protegido - Role 'admin' ou 'moderator') Exemplo de rota restrita a múltiplos papéis.

**Documentação Interativa (apiDoc):**

Após iniciar a API, acesse: `http://localhost:PORT/docs`

## 🧪 Testando

* Use ferramentas como [Postman](https://www.postman.com/), [Insomnia](https://insomnia.rest/) ou `curl`.
* **Fluxo de Registro:**
    1.  Faça login como admin.
    2.  Use o token do admin para chamar `POST /api/admin/invite-codes` e obter um código.
    3.  Chame `POST /api/auth/register` com `username`, `password` e o `inviteCode` obtido.
* **Fluxo Admin Create:**
    1.  Faça login como admin.
    2.  Use o token do admin para chamar `POST /api/admin/users` com `username`, `password` e (opcionalmente) `role` no corpo.
* Lembre-se de incluir o `Content-Type: application/json` para `POST` e o header `Authorization: Bearer <seu_access_token>` para rotas protegidas.

## 🚀 Deploy (Ex: Render.com)

1.  Faça o commit do seu código para um repositório Git (GitHub, GitLab). **NÃO** inclua o arquivo `.env` no commit.
2.  Crie um "Web Service" no Render e conecte-o ao seu repositório.
3.  **Configurações no Render:**
    * **Build Command:** `npm install && npm run docs` (Instala dependências E gera a documentação estática).
    * **Start Command:** `npm start` (Executará `seed:admin` e depois `node server.js`).
    * **Environment Variables:** Configure **TODAS** as variáveis de ambiente necessárias (listadas na seção de configuração `.env`) diretamente no painel do Render. Use valores fortes e únicos para os segredos JWT e credenciais de admin!
    * **Publish Directory (se aplicável):** Se o Render perguntar por um diretório de publicação (para sites estáticos, não comum para web services Node, mas caso use), aponte para `public` ou deixe em branco. O `express.static` cuidará de servir `/docs`.
4.  O Render fará o build e deploy automaticamente.

## 🤝 Contribuição

Contribuições são bem-vindas (se aplicável). Por favor, siga as boas práticas de desenvolvimento.

## 📄 Licença

Este projeto está licenciado sob a Licença ISC.

---
*Atualizado por Marquin - Engenheiro de Software Sênior - ${new Date().toLocaleDateString('pt-BR')}*