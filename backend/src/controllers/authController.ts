/**
 * ============================================
 * CONTROLLER DE AUTENTICAÇÃO
 * ============================================
 * 
 * Este arquivo contém toda a lógica de negócio relacionada à autenticação:
 * - Registro de novos usuários (email/senha)
 * - Login de usuários (email/senha)
 * - Login com Google (via Firebase ID token)
 * - Logout (invalidação de tokens e sessões)
 * 
 * Estrutura:
 * 1. Funções helper no topo (validações, hash, etc.)
 * 2. Controllers principais (register, login, loginWithGoogle, logout)
 * 
 * Cada função faz seu trabalho diretamente:
 * - Valida dados de entrada
 * - Interage diretamente com Firebase (Firestore)
 * - Gera tokens JWT
 * - Gerencia sessões e blacklist
 * - Retorna respostas JSON
 * 
 * Nota: Firebase Firestore é NoSQL (sem schemas rígidos).
 * Cada documento é um objeto JSON que pode ter campos diferentes.
 */

import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { db, auth } from '../config/firebase.js';
import { generateToken, decodeTokenFull } from '../utils/jwt.js';

// ============================================
// FUNÇÕES HELPER SIMPLES
// ============================================

// Validar email
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Gerar UID único baseado no email
function generateUID(email: string): string {
  return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex').substring(0, 32);
}

// Gerar ID de sessão
function generateSessionId(): string {
  return crypto.randomBytes(16).toString('hex');
}

// Hash de token para blacklist
async function hashToken(token: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(token, salt);
}

// Pegar informações da requisição
function getRequestInfo(req: Request) {
  let ipAddress: string | undefined;
  
  if (req.ip) {
    ipAddress = req.ip;
  } else if (req.headers['x-forwarded-for']) {
    const forwarded = req.headers['x-forwarded-for'];
    ipAddress = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
  } else if (req.socket.remoteAddress) {
    ipAddress = req.socket.remoteAddress;
  }
  
  return {
    ipAddress,
    userAgent: req.headers['user-agent'] || undefined,
  };
}

// Extrair token do header
function getToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return req.body.token || null;
}

// ============================================
// CONTROLLERS
// ============================================

/**
 * Registrar novo usuário
 * POST /api/auth/register
 */
export async function register(req: Request, res: Response) {
  try {
    const { email, password, name } = req.body;

    // Validar campos obrigatórios
    if (!email || !password || !name) {
      return res.status(400).json({
        error: 'Todos os campos são obrigatórios',
        fields: { email: !email, password: !password, name: !name }
      });
    }

    // Validar formato de email
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Formato de email inválido' });
    }

    // Validar senha (mínimo 8 caracteres)
    if (password.length < 8) {
      return res.status(400).json({ error: 'Senha deve ter pelo menos 8 caracteres' });
    }

    // Validar nome (mínimo 2 caracteres)
    if (name.trim().length < 2) {
      return res.status(400).json({ error: 'Nome deve ter pelo menos 2 caracteres' });
    }

    // Verificar se email já existe
    const userRef = db.collection('users').doc(email.toLowerCase());
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      return res.status(409).json({ error: 'Email já cadastrado' });
    }

    // Gerar UID único
    const uid = generateUID(email.toLowerCase());

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Criar usuário no Firestore
    const userData = {
      uid,
      email: email.toLowerCase(),
      password: hashedPassword,
      name: name.trim(),
      provider: 'email',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await userRef.set(userData);

    // Gerar token JWT
    const token = generateToken({ uid, email: email.toLowerCase() });

    // Retornar resposta
    return res.status(201).json({
      message: 'Usuário criado com sucesso',
      token,
      user: {
        uid,
        email: userData.email,
        name: userData.name,
        provider: 'email',
      },
    });
  } catch (error) {
    console.error('Erro ao registrar:', error);
    return res.status(500).json({
      error: 'Erro interno ao registrar usuário',
      message: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}

/**
 * Login de usuário
 * POST /api/auth/login
 */
export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    // Validar campos obrigatórios
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email e senha são obrigatórios',
        fields: { email: !email, password: !password }
      });
    }

    // Validar formato de email
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Formato de email inválido' });
    }

    // Buscar usuário no Firestore
    const userRef = db.collection('users').doc(email.toLowerCase());
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      // Mesma mensagem para não revelar se email existe
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    }

    const user = userDoc.data();

    if (!user || !user.password || user.provider !== 'email') {
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    }

    // Verificar senha
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    }

    // Gerar token JWT
    const token = generateToken({
      uid: user.uid,
      email: user.email,
    });

    // Criar sessão
    const sessionId = generateSessionId();
    const tokenHash = await hashToken(token);
    const { ipAddress, userAgent } = getRequestInfo(req);

    await db.collection('sessions').doc(sessionId).set({
      sessionId,
      uid: user.uid,
      email: user.email,
      token: tokenHash,
      createdAt: new Date(),
      lastActivity: new Date(),
      ipAddress,
      userAgent,
      isActive: true,
    });

    // Atualizar último login
    await userRef.update({ updatedAt: new Date() });

    // Retornar resposta
    return res.status(200).json({
      message: 'Login realizado com sucesso',
      token,
      sessionId,
      user: {
        uid: user.uid,
        email: user.email,
        name: user.name,
        provider: user.provider,
      },
    });
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    return res.status(500).json({
      error: 'Erro interno ao fazer login',
      message: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}

/**
 * Login com Google
 * POST /api/auth/google
 */
export async function loginWithGoogle(req: Request, res: Response) {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: 'ID token é obrigatório' });
    }

    // Verificar ID token do Firebase
    const decodedToken = await auth.verifyIdToken(idToken);

    // Buscar ou criar usuário
    let user = await db.collection('users')
      .where('uid', '==', decodedToken.uid)
      .limit(1)
      .get();

    let userData;

    if (user.empty) {
      // Criar novo usuário
      userData = {
        uid: decodedToken.uid,
        email: decodedToken.email || '',
        name: decodedToken.name || '',
        picture: decodedToken.picture,
        provider: 'google',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.collection('users').doc(decodedToken.email?.toLowerCase() || decodedToken.uid).set(userData);
    } else {
      // Atualizar dados do usuário
      userData = user.docs[0].data();
      await user.docs[0].ref.update({
        name: decodedToken.name || userData.name,
        picture: decodedToken.picture || userData.picture,
        updatedAt: new Date(),
      });
      userData = { ...userData, ...decodedToken };
    }

    // Gerar token JWT
    const token = generateToken({
      uid: decodedToken.uid,
      email: decodedToken.email!,
    });

    // Retornar resposta
    return res.status(200).json({
      message: 'Login com Google realizado com sucesso',
      token,
      user: {
        uid: userData.uid,
        email: userData.email,
        name: userData.name,
        picture: userData.picture,
        provider: 'google',
      },
    });
  } catch (error) {
    console.error('Erro ao fazer login com Google:', error);
    return res.status(401).json({
      error: 'Token inválido ou expirado',
      message: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}

/**
 * Logout de usuário
 * POST /api/auth/logout
 */
export async function logout(req: Request, res: Response) {
  try {
    const token = getToken(req);

    if (!token) {
      return res.status(400).json({ error: 'Token não fornecido' });
    }

    // Decodificar token
    const tokenData = decodeTokenFull(token);
    const { uid, email } = tokenData;

    // Verificar se token está na blacklist
    const tokenHash = await hashToken(token);
    const blacklistRef = db.collection('tokenBlacklist');
    const snapshot = await blacklistRef.get();

    if (!snapshot.empty) {
      for (const doc of snapshot.docs) {
        const blacklistData = doc.data();
        if (blacklistData.token && await bcrypt.compare(token, blacklistData.token)) {
          return res.status(401).json({ error: 'Token já foi invalidado' });
        }
      }
    }

    // Adicionar token à blacklist
    const expiresAt = tokenData.exp
      ? new Date(tokenData.exp * 1000)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const docId = crypto.createHash('sha256').update(tokenHash).digest('hex').substring(0, 32);

    await blacklistRef.doc(docId).set({
      token: tokenHash,
      uid,
      email,
      expiresAt,
      blacklistedAt: new Date(),
      reason: 'logout',
    });

    // Invalidar todas as sessões do usuário
    const sessionsRef = db.collection('sessions');
    const activeSessions = await sessionsRef
      .where('uid', '==', uid)
      .where('isActive', '==', true)
      .get();

    const batch = db.batch();
    activeSessions.forEach((doc) => {
      batch.update(doc.ref, {
        isActive: false,
        invalidatedAt: new Date(),
      });
    });
    await batch.commit();

    return res.status(200).json({
      message: 'Logout realizado com sucesso',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Erro ao fazer logout:', error);
    return res.status(500).json({
      error: 'Erro interno ao fazer logout',
      message: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}
