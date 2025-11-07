# Backend API

## Ambiente (.env)

Crie um arquivo `.env` dentro da pasta `backend` com as chaves abaixo:

```env
# App
APP_BASE_URL=http://localhost:5173

# Firebase Admin
FIREBASE_PROJECT_ID=seu-projeto
FIREBASE_CLIENT_EMAIL=seu-email@seu-projeto.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# JWT
JWT_SECRET=uma-chave-secreta
JWT_EXPIRES_IN=7d

# SMTP (opcional, usado para enviar emails reais)
SMTP_HOST=smtp.seudominio.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=usuario
SMTP_PASS=senha
EMAIL_FROM=nao-responda@seudominio.com

# URLs para links gerados pelo Firebase (opcional)
EMAIL_VERIFICATION_CONTINUE_URL=http://localhost:5173/login
PASSWORD_RESET_CONTINUE_URL=http://localhost:5173/reset-password
FIREBASE_DYNAMIC_LINK_DOMAIN=
FIREBASE_HANDLE_CODE_IN_APP=false
```

## Endpoints principais

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/google`
- `POST /api/auth/resend-verification`
- `POST /api/auth/request-password-reset`
- `POST /api/auth/logout`

> Emails de verificação e recuperação usam os links gerados pelo Firebase Authentication.

## Desenvolvimento

```bash
cd backend
npm install
npm run dev
```
