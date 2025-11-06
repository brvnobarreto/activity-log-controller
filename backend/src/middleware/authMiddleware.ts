/**
 * ============================================
 * MIDDLEWARE DE AUTENTICAÇÃO
 * ============================================
 * 
 * Este arquivo contém o middleware que protege rotas que precisam de autenticação.
 * 
 * O que ele faz:
 * 1. Pega o token JWT do header Authorization ("Bearer TOKEN")
 * 2. Verifica se o token está na blacklist (tokens inválidos/logout)
 * 3. Verifica se o token é válido e não expirou
 * 4. Adiciona os dados do usuário (uid, email) em req.user
 * 5. Permite que a requisição continue (next()) ou bloqueia (401/403)
 * 
 * Como usar:
 * - Importe o middleware: import { authenticate } from './middleware/authMiddleware'
 * - Use nas rotas: router.get('/rota-protegida', authenticate, minhaFuncao)
 * 
 * Após passar pelo middleware, você terá acesso a req.user com uid e email
 */

import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';
import bcrypt from 'bcrypt';
import { db } from '../config/firebase.js';

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
 * Verifica se o token JWT é válido e não está na blacklist
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    // Pegar token do header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.substring(7);

    // Verificar se token está na blacklist
    const blacklistRef = db.collection('tokenBlacklist');
    const snapshot = await blacklistRef.get();

    if (!snapshot.empty) {
      const now = new Date();

      for (const doc of snapshot.docs) {
        const blacklistData = doc.data();

        // Remover tokens expirados
        const expiresAt = blacklistData.expiresAt?.toDate?.() || blacklistData.expiresAt;
        if (expiresAt && expiresAt < now) {
          await doc.ref.delete();
          continue;
        }

        // Verificar se token está na blacklist
        if (blacklistData.token && await bcrypt.compare(token, blacklistData.token)) {
          return res.status(401).json({ error: 'Token foi invalidado' });
        }
      }
    }

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
