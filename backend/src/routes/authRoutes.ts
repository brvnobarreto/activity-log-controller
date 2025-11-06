/**
 * ============================================
 * ROTAS DE AUTENTICAÇÃO
 * ============================================
 * 
 * Este arquivo define todas as rotas relacionadas à autenticação.
 * 
 * Rotas disponíveis (prefixo: /api/auth):
 * - POST /api/auth/register  → Registrar novo usuário (email/senha)
 * - POST /api/auth/login      → Login de usuário (email/senha)
 * - POST /api/auth/google      → Login com Google (Firebase ID token)
 * - POST /api/auth/logout      → Logout de usuário (invalida token)
 * 
 * Cada rota está conectada a uma função no authController.ts
 * que contém toda a lógica de negócio.
 */

import express from 'express';
import { register, login, loginWithGoogle, logout } from '../controllers/authController.js';

const router = express.Router();

// Rotas de autenticação
router.post('/register', register);      // Registrar novo usuário
router.post('/login', login);             // Login de usuário
router.post('/google', loginWithGoogle);  // Login com Google
router.post('/logout', logout);           // Logout de usuário

export default router;

