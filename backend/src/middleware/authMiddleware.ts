/**
 * ============================================
 * MIDDLEWARE DE AUTENTICAÇÃO
 * ============================================
 * 
 * Este arquivo contém o middleware que protege rotas que precisam de autenticação.
 * 
 * O que ele faz:
 * 1. Pega o token JWT do header Authorization ("Bearer TOKEN")
 * 2. Verifica se o token é válido e não expirou
 * 3. Adiciona os dados do usuário (uid, email) em req.user
 * 4. Permite que a requisição continue (next()) ou bloqueia (401/403)
 * 
 * Como usar:
 * - Importe o middleware: import { authenticate } from './middleware/authMiddleware'
 * - Use nas rotas: router.get('/rota-protegida', authenticate, minhaFuncao)
 * 
 * Após passar pelo middleware, acessa a req.user com uid e email
 */

import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';

// Adicionar user ao Request do Express (para ter req.user disponível)
declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email: string;
      };
    }
  }
}

/**
 * Middleware de autenticação
 * Verifica se o token JWT é válido e não expirou
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    // Pegar token do header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.substring(7);

    // Verificar e decodificar token
    try {
      const decoded = verifyToken(token);
      req.user = {
        uid: decoded.uid,
        email: decoded.email,
      };
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Token inválido ou expirado' });
    }
  } catch (error) {
    console.error('Erro na autenticação:', error);
    return res.status(500).json({ error: 'Erro interno na autenticação' });
  }
}
