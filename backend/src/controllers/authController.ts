/**
 * ============================================
 * AUTH CONTROLLER (EXPRESS + FIREBASE)
 * ============================================
 *
 * O objetivo deste arquivo é deixar o fluxo de autenticação fácil de entender
 * para quem está começando. Tudo está separado em etapas bem comentadas:
 *
 * 1. Helpers simples (validação de email, geração de IDs, coleta de dados da requisição).
 * 2. Registro: cria o usuário no Firebase Auth e salva um perfil básico no Firestore.
 * 3. Login: recebe um idToken gerado pelo Firebase no frontend, valida e devolve um token da API.
 * 4. Login com Google: aproveita o idToken retornado pelo Firebase Client SDK.
 * 5. Logout: encerra as sessões armazenadas na collection `sessions`.
 * 6. Fluxos de email: reenviar verificação e pedir redefinição de senha usando os links do Firebase.
 *
 * Sobre senha e verificação:
 * - O Firebase cuida do armazenamento seguro da senha e do estado “email verificado”.
 * - O backend apenas orquestra a criação dos usuários, valida idTokens e envia emails amigáveis.
 */

import { Request, Response } from 'express';
import crypto from 'crypto';
import { db, auth, FieldValue } from '../config/firebase.js';
import { generateToken, decodeTokenFull } from '../utils/jwt.js';

const DEFAULT_ROLE = 'fiscal';

function extractRoleFromStructure(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const extracted = extractRoleFromStructure(item);
      if (extracted) return extracted;
    }
    return null;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const directKeys = ['role', 'primary', 'nome'];
    for (const key of directKeys) {
      const raw = obj[key];
      if (typeof raw === 'string' && raw.trim().length) {
        return raw.trim();
      }
    }
    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === 'boolean' && val && key.trim().length) {
        return key.trim();
      }
    }
    for (const val of Object.values(obj)) {
      const extracted = extractRoleFromStructure(val);
      if (extracted) return extracted;
    }
  }
  return null;
}

// ============================================
// FUNÇÕES HELPER SIMPLES
// ============================================

// Validar email
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Gerar ID de sessão
function generateSessionId(): string {
  return crypto.randomBytes(16).toString('hex');
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

type RequestWithUser = Request & {
  user?: {
    uid: string;
    email: string;
  };
};

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

    // Passo 1: validar os dados enviados pelo frontend
    if (!email || !password || !name) {
      return res.status(400).json({
        error: 'Todos os campos são obrigatórios',
        fields: { email: !email, password: !password, name: !name },
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Formato de email inválido' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Senha deve ter pelo menos 8 caracteres' });
    }

    if (name.trim().length < 2) {
      return res.status(400).json({ error: 'Nome deve ter pelo menos 2 caracteres' });
    }

    const emailLower = email.toLowerCase();

    // Passo 2: cria o usuário no Firebase Authentication (ele cuida da senha para nós)
    let firebaseUser;
    try {
      firebaseUser = await auth.createUser({
        email: emailLower,
        password,
        displayName: name.trim(),
      });
    } catch (firebaseError: any) {
      if (firebaseError.code === 'auth/email-already-exists') {
        return res.status(409).json({ error: 'Email já cadastrado' });
      }

      console.error('Erro ao criar usuário no Firebase Auth:', firebaseError);
      return res.status(500).json({ error: 'Erro interno ao criar usuário' });
    }

    await db.collection('users').doc(emailLower).set({
      uid: firebaseUser.uid,
      email: emailLower,
      name: name.trim(),
      provider: 'email',
      role: DEFAULT_ROLE,
      emailVerified: firebaseUser.emailVerified,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return res.status(201).json({
      message: 'Usuário criado com sucesso. Verifique seu email antes de fazer login.',
      user: {
        uid: firebaseUser.uid,
        email: emailLower,
        name: name.trim(),
        provider: 'email',
        role: DEFAULT_ROLE,
        emailVerified: firebaseUser.emailVerified,
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
    const { idToken } = req.body;

    // Passo 1: receber o idToken gerado pelo Firebase no frontend
    if (!idToken || typeof idToken !== 'string') {
      return res.status(400).json({ error: 'idToken obrigatório' });
    }

    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch (verifyError) {
      console.error('Erro ao validar idToken:', verifyError);
      return res.status(401).json({ error: 'Token inválido ou expirado' });
    }

    const email = decodedToken.email?.toLowerCase();

    if (!email) {
      return res.status(400).json({ error: 'Token sem email associado' });
    }

    // Passo 2: conferir se o email já está verificado no Firebase
    const firebaseUser = await auth.getUser(decodedToken.uid);

    if (!firebaseUser.emailVerified) {
      return res.status(403).json({ error: 'Email ainda não verificado.' });
    }

    // Passo 3: carregar (ou criar) o perfil salvo no Firestore
    const userRef = db.collection('users').doc(email);
    const userDoc = await userRef.get();

    const profileData = userDoc.exists
      ? userDoc.data()
      : {
          uid: decodedToken.uid,
          email,
          name: firebaseUser.displayName || '',
          provider: firebaseUser.providerData[0]?.providerId || 'email',
          role: DEFAULT_ROLE,
        };

    // Garantir que o documento existe/esteja atualizado
    await userRef.set(
      {
        uid: decodedToken.uid,
        email,
        name: profileData?.name || firebaseUser.displayName || '',
        picture: profileData?.picture || firebaseUser.photoURL || '',
        provider: profileData?.provider || 'email',
        emailVerified: true,
        role: profileData?.role || DEFAULT_ROLE,
        updatedAt: FieldValue.serverTimestamp(),
        lastLoginAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Passo 4: registrar uma sessão simples para fins de auditoria
    const sessionId = generateSessionId();
    const { ipAddress, userAgent } = getRequestInfo(req);

    await db.collection('sessions').doc(sessionId).set({
      sessionId,
      uid: decodedToken.uid,
      email,
      createdAt: FieldValue.serverTimestamp(),
      lastActivity: FieldValue.serverTimestamp(),
      ipAddress,
      userAgent,
      isActive: true,
    });

    // Passo 5: gerar o token da API (útil para proteger rotas do seu backend)
    const appToken = generateToken({ uid: decodedToken.uid, email });

    return res.status(200).json({
      message: 'Login realizado com sucesso',
      token: appToken,
      sessionId,
      user: {
        uid: decodedToken.uid,
        email,
        name: profileData?.name || firebaseUser.displayName || '',
        picture: profileData?.picture || firebaseUser.photoURL || undefined,
        provider: profileData?.provider || 'email',
        emailVerified: true,
        role: profileData?.role || DEFAULT_ROLE,
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
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        emailVerified: true,
        role: DEFAULT_ROLE,
      };

      await db.collection('users').doc(decodedToken.email?.toLowerCase() || decodedToken.uid).set(userData);
    } else {
      // Atualizar dados do usuário
      userData = user.docs[0].data();
      await user.docs[0].ref.update({
        name: decodedToken.name || userData.name,
        picture: decodedToken.picture || userData.picture,
        updatedAt: FieldValue.serverTimestamp(),
        emailVerified: true,
        role: userData.role || DEFAULT_ROLE,
      });
      userData = { ...userData, ...decodedToken };
      userData.emailVerified = true;
      userData.role = userData.role || DEFAULT_ROLE;
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
        emailVerified: true,
        role: userData.role || DEFAULT_ROLE,
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

    // Passo 1: garantir que recebemos o token gerado pela API (Bearer token)
    if (!token) {
      return res.status(400).json({ error: 'Token não fornecido' });
    }

    // Decodificar token para obter dados do usuário
    const tokenData = decodeTokenFull(token);
    const { uid } = tokenData;

    // Invalidar todas as sessões ativas do usuário
    const sessionsRef = db.collection('sessions');
    const activeSessions = await sessionsRef
      .where('uid', '==', uid)
      .where('isActive', '==', true)
      .get();

    if (!activeSessions.empty) {
      const batch = db.batch();
      activeSessions.forEach((doc) => {
        batch.update(doc.ref, {
          isActive: false,
          invalidatedAt: FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
    }

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

/**
 * Buscar usuário autenticado
 * GET /api/auth/me
 */
export async function getCurrentUser(req: RequestWithUser, res: Response) {
  try {
    const sessionUser = req.user;
    if (!sessionUser) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const { uid, email } = sessionUser;
    const emailLower = email.toLowerCase();

    const userRef = db.collection('users').doc(emailLower);
    const userDoc = await userRef.get();

    let storedData = userDoc.exists ? userDoc.data() || {} : {};

    if (!userDoc.exists) {
      try {
        const firebaseUser = await auth.getUser(uid);
        storedData = {
          uid,
          email,
          name: firebaseUser.displayName || '',
          picture: firebaseUser.photoURL || '',
          provider: firebaseUser.providerData[0]?.providerId || 'email',
          emailVerified: firebaseUser.emailVerified ?? true,
          role: DEFAULT_ROLE,
        };
        await userRef.set({
          ...storedData,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      } catch (firebaseError) {
        console.error('Erro ao obter usuário do Firebase Auth:', firebaseError);
        storedData = {
          uid,
          email,
          name: '',
          picture: '',
          provider: 'email',
          emailVerified: true,
          role: DEFAULT_ROLE,
        };
      }
    }

    const resolvedRole =
      extractRoleFromStructure(storedData.role) ||
      extractRoleFromStructure((storedData as any)?.perfil?.role) ||
      extractRoleFromStructure((storedData as any)?.profile?.role) ||
      extractRoleFromStructure((storedData as any)?.roles) ||
      DEFAULT_ROLE;

    const responseUser = {
      uid,
      email,
      name: typeof storedData.name === 'string' ? storedData.name : '',
      picture: typeof storedData.picture === 'string' ? storedData.picture : '',
      provider: typeof storedData.provider === 'string' ? storedData.provider : 'email',
      emailVerified: typeof storedData.emailVerified === 'boolean' ? storedData.emailVerified : true,
      role: resolvedRole,
      roles: (storedData as any)?.roles ?? null,
      perfil: (storedData as any)?.perfil ?? null,
      profile: (storedData as any)?.profile ?? null,
    };

    return res.status(200).json({ user: responseUser });
  } catch (error) {
    console.error('Erro ao carregar usuário atual:', error);
    return res.status(500).json({
      error: 'Erro interno ao carregar usuário',
      message: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}
