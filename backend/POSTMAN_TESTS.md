# Testes no Postman

> Antes de enviar requisições, inicie o servidor com `npm run dev` dentro de `backend/`.

## URLs úteis

- Base URL: `http://localhost:3001`
- Health check: `GET /api/health`

## 1. Registro (`POST /api/auth/register`)

**Body (JSON):**
```json
{
  "email": "novo@teste.com",
  "password": "senha1234",
  "name": "Novo Usuário"
}
```

- Em ambiente sem SMTP configurado, o link de verificação será exibido no console
  (procure por `[EmailService]` no terminal do backend).
- O login só funciona após confirmar o email através do link gerado pelo Firebase.

## 2. Login (`POST /api/auth/login`)

O backend espera um **idToken** emitido pelo Firebase. A sequência é:

1. Use o Firebase Client SDK (ou a API REST do Firebase) para fazer login com email/senha:

   ```http
   POST https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=SUA_API_KEY
   Content-Type: application/json

   {
     "email": "novo@teste.com",
     "password": "senha1234",
     "returnSecureToken": true
   }
   ```

   A resposta contém `idToken`.

2. Envie o `idToken` para o backend:

   ```json
   {
     "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6Ij..."
   }
   ```

3. O backend devolve o token da API (`token`) e o `sessionId`. Guarde os dois para chamadas autenticadas.

## 3. Google (`POST /api/auth/google`)

- Espera um `idToken` gerado no frontend com Firebase Auth.
- Útil apenas após integrar o app web/mobile.

## 4. Perfil atual (`GET /api/auth/me`)

**Headers:**
```
Authorization: Bearer {{token}}
```

- Retorna o usuário vinculado ao token salvo.

## 5. Logout (`POST /api/auth/logout`)

**Headers:**
```
Authorization: Bearer SEU_TOKEN
```

- Invalida as sessões salvas na collection `sessions`.

## Variáveis de ambiente no Postman

Crie um Environment com as variáveis abaixo:

```
base_url = http://localhost:3001
email = novo@teste.com
password = senha1234
token = (preenchido após o login)
```

Use nos endpoints:
- `{{base_url}}/api/auth/login`
- `Authorization: Bearer {{token}}`

No request de login, adicione em **Tests** para salvar o token automaticamente:
```javascript
if (pm.response.code === 200) {
  const json = pm.response.json();
  if (json.token) {
    pm.environment.set('token', json.token);
  }
}
```

## Observações

- Os e-mails de verificação e redefinição são enviados pelo próprio Firebase Authentication.
- Personalize os templates no console do Firebase (Authentication → Templates) para alterar textos e links.
- O backend ainda emite seu próprio JWT (`token`) para ser usado pelas rotas protegidas (ex.: `/api/auth/me`).
