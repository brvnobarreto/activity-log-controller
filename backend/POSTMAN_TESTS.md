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

**Body (JSON):**
```json
{
  "email": "novo@teste.com",
  "password": "senha1234"
}
```

- Retorna `403` se o email ainda não estiver verificado.
- Salve o `token` e o `sessionId` retornados para chamadas autenticadas.

## 3. Google (`POST /api/auth/google`)

- Espera um `idToken` gerado no frontend com Firebase Auth.
- Útil apenas após integrar o app web/mobile.

## 4. Reenviar verificação (`POST /api/auth/resend-verification`)

**Body (JSON):**
```json
{
  "email": "novo@teste.com"
}
```

- Envia novamente o link de verificação usando o Firebase.

## 5. Recuperação de senha (`POST /api/auth/request-password-reset`)

**Body (JSON):**
```json
{
  "email": "novo@teste.com"
}
```

- O Firebase gera o link de redefinição; será enviado por email (ou exibido no console caso SMTP não esteja configurado).
- A redefinição em si é concluída através do link fornecido pelo Firebase.

## 6. Logout (`POST /api/auth/logout`)

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

- Os links de verificação/redefinição expiram seguindo as regras do Firebase (normalmente ~1h).
- Configure SMTP no `.env` para enviar emails reais. Sem SMTP, os links são mostrados no console.
- O backend ainda emite seu próprio JWT (`token`) para ser usado pelas rotas protegidas.
