/**
 * ============================================
 * ROTAS DE AUTENTICAÇÃO
 * ============================================
 * 
 * Este arquivo define todas as rotas relacionadas à autenticação.
 * 
 * Rotas disponíveis (prefixo: /api/auth):
 * - POST /api/auth/register               → Cria usuário no Firebase e envia email de verificação
 * - POST /api/auth/login                  → Recebe idToken do Firebase e devolve token da API
 * - POST /api/auth/google                 → Login com Google (passar idToken do Firebase)
 * - POST /api/auth/resend-verification    → Reenvia email de confirmação
 * - POST /api/auth/request-password-reset → Dispara email de recuperação de senha
 * - POST /api/auth/logout                 → Encerra sessões criadas pelo backend
 * 
 * Cada rota está conectada a uma função no authController.ts
 * que contém toda a lógica de negócio.
 */

import express from 'express';
import {
  register,
  login,
  loginWithGoogle,
  logout,
  resendVerificationEmail,
  requestPasswordReset,
} from '../controllers/authController.js';

const router = express.Router();

// Rotas de autenticação
router.post('/register', register);      // Registrar novo usuário
router.post('/login', login);             // Login de usuário
router.post('/google', loginWithGoogle);  // Login com Google
router.post('/resend-verification', resendVerificationEmail); // Reenviar email de verificação
router.post('/request-password-reset', requestPasswordReset); // Solicitar recuperação de senha
router.post('/logout', logout);           // Logout de usuário

export default router;

