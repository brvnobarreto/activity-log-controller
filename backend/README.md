# Backend API

## Ambiente (.env)

Crie um arquivo `.env` dentro da pasta `backend` com as chaves abaixo:

```env
# Firebase Admin
FIREBASE_PROJECT_ID=seu-projeto
FIREBASE_CLIENT_EMAIL=seu-email@seu-projeto.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# JWT
JWT_SECRET=uma-chave-secreta
JWT_EXPIRES_IN=7d
```

> O envio de emails de verificação e recuperação fica inteiramente a cargo do Firebase Authentication.
> Use as templates do console para personalizar os textos e links.
> Usuários cadastrados começam com o papel `fiscal`. Atualize o campo `role` no Firestore/Firebase para promover a `supervisor`.

## Endpoints principais

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/google`
- `POST /api/auth/logout`
- `GET /api/auth/me`

## Desenvolvimento

```bash
cd backend
npm install
npm run dev
```
