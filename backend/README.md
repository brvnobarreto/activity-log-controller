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
  - Cria o usuário no Firebase Auth e grava o perfil no Firestore. Retorna apenas uma mensagem e dados básicos.
- `POST /api/auth/login`
  - Recebe `idToken` do Firebase (obtido no frontend) e devolve o token da API + dados do usuário.
- `POST /api/auth/google`
  - Mesmo comportamento do login, mas usando o `idToken` do provedor Google.
- `POST /api/auth/resend-verification`
  - Reenvia o email de verificação através do Firebase.
- `POST /api/auth/request-password-reset`
  - Gera o link de redefinição via Firebase.
- `POST /api/auth/logout`
  - Marca as sessões criadas pela API como inativas.

> Os emails (verificação e recuperação) são enviados usando o serviço do Firebase Authentication. Sem SMTP configurado, os links aparecem no console.

## Desenvolvimento

```bash
cd backend
npm install
npm run dev
```
