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
import type { ActionCodeSettings } from 'firebase-admin/auth';
import { db, auth, FieldValue } from '../config/firebase.js';
import { generateToken, decodeTokenFull } from '../utils/jwt.js';
import { sendEmail } from '../utils/emailService.js';

const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:5173';
const EMAIL_VERIFICATION_CONTINUE_URL = process.env.EMAIL_VERIFICATION_CONTINUE_URL || `${APP_BASE_URL}/login`;
const PASSWORD_RESET_CONTINUE_URL = process.env.PASSWORD_RESET_CONTINUE_URL || `${APP_BASE_URL}/reset-password`;
const FIREBASE_DYNAMIC_LINK_DOMAIN = process.env.FIREBASE_DYNAMIC_LINK_DOMAIN;
const FIREBASE_HANDLE_CODE_IN_APP = process.env.FIREBASE_HANDLE_CODE_IN_APP === 'true';

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

function buildActionCodeSettings(url?: string): ActionCodeSettings | undefined {
  if (!url) return undefined;

  const settings: ActionCodeSettings = { url };

  if (FIREBASE_HANDLE_CODE_IN_APP) {
    settings.handleCodeInApp = true;
  }

  if (FIREBASE_DYNAMIC_LINK_DOMAIN) {
    settings.dynamicLinkDomain = FIREBASE_DYNAMIC_LINK_DOMAIN;
  }

  return settings;
}

async function sendVerificationEmailMessage(email: string, name: string | undefined): Promise<void> {
  const verificationLink = await auth.generateEmailVerificationLink(
    email.toLowerCase(),
    buildActionCodeSettings(EMAIL_VERIFICATION_CONTINUE_URL)
  );
  const greeting = name ? `Olá, ${name}!` : 'Olá!';

  await sendEmail({
    to: email,
    subject: 'Confirme seu email',
    html: `
      <p>${greeting}</p>
      <p>Obrigado por se registrar. Clique no botão abaixo para confirmar seu email:</p>
      <p><a href="${verificationLink}" style="background:#2563eb;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;">Confirmar email</a></p>
      <p>Se o botão não funcionar, copie e cole este link no navegador:</p>
      <p>${verificationLink}</p>
    `,
    text: `${greeting}\n\nConfirme seu email acessando o link: ${verificationLink}`,
  });
}

async function sendPasswordResetEmailMessage(email: string, name: string | undefined): Promise<void> {
  const resetLink = await auth.generatePasswordResetLink(
    email.toLowerCase(),
    buildActionCodeSettings(PASSWORD_RESET_CONTINUE_URL)
  );
  const greeting = name ? `Olá, ${name}!` : 'Olá!';

  await sendEmail({
    to: email,
    subject: 'Recuperação de senha',
    html: `
      <p>${greeting}</p>
      <p>Recebemos um pedido para redefinir sua senha. Clique no botão abaixo para criar uma nova senha:</p>
      <p><a href="${resetLink}" style="background:#2563eb;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;">Redefinir senha</a></p>
      <p>Se o botão não funcionar, copie e cole este link no navegador:</p>
      <p>${resetLink}</p>
      <p>Se você não solicitou esta ação, ignore este email.</p>
    `,
    text: `${greeting}\n\nRedefina sua senha acessando o link: ${resetLink}\nSe você não solicitou, ignore este email.`,
  });
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

    const userRef = db.collection('users').doc(emailLower);

    // Passo 3: salva um resumo do perfil no Firestore (útil para suas telas)
    await userRef.set({
      uid: firebaseUser.uid,
      email: emailLower,
      name: name.trim(),
      provider: 'email',
      emailVerified: firebaseUser.emailVerified,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Passo 4: dispara o email de verificação (ou apenas loga o link no console, caso SMTP não esteja configurado)
    try {
      await sendVerificationEmailMessage(emailLower, name);
    } catch (emailError) {
      console.error('Erro ao enviar email de verificação:', emailError);
    }

    return res.status(201).json({
      message: 'Usuário criado com sucesso. Verifique seu email antes de fazer login.',
      user: {
        uid: firebaseUser.uid,
        email: emailLower,
        name: name.trim(),
        provider: 'email',
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
      });
      userData = { ...userData, ...decodedToken };
      userData.emailVerified = true;
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
 * Reenviar email de verificação
 * POST /api/auth/resend-verification
 */
export async function resendVerificationEmail(req: Request, res: Response) {
  try {
    const { email } = req.body;

    // Passo 1: validar email
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }

    const emailLower = email.toLowerCase();

    // Passo 2: buscar o usuário no Firebase Auth
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(emailLower);
    } catch (firebaseError: any) {
      if (firebaseError.code === 'auth/user-not-found') {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      console.error('Erro ao buscar usuário no Firebase Auth:', firebaseError);
      return res.status(500).json({ error: 'Erro interno ao buscar usuário' });
    }

    if (userRecord.emailVerified) {
      return res.status(400).json({ error: 'Email já foi verificado' });
    }

    // Passo 3: recuperar dados extras do Firestore (nome, foto etc.)
    const userRef = db.collection('users').doc(emailLower);
    const userDoc = await userRef.get();
    const userData = userDoc.exists ? userDoc.data() : undefined;

    // Passo 4: pedir ao Firebase para gerar e enviar (ou logar) o link de verificação
    try {
      await sendVerificationEmailMessage(emailLower, userData?.name || userRecord.displayName || undefined);
    } catch (emailError) {
      console.error('Erro ao reenviar email de verificação:', emailError);
      return res.status(500).json({ error: 'Erro interno ao reenviar email de verificação' });
    }

    return res.status(200).json({ message: 'Email de verificação reenviado com sucesso' });
  } catch (error) {
    console.error('Erro ao reenviar email de verificação:', error);
    return res.status(500).json({
      error: 'Erro interno ao reenviar email de verificação',
      message: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}

/**
 * Solicitar recuperação de senha
 * POST /api/auth/request-password-reset
 */
export async function requestPasswordReset(req: Request, res: Response) {
  try {
    const { email } = req.body;

    // Passo 1: validar email
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }

    const emailLower = email.toLowerCase();
    let userRecord;

    try {
      userRecord = await auth.getUserByEmail(emailLower);
    } catch (firebaseError: any) {
      if (firebaseError.code === 'auth/user-not-found') {
        return res.status(200).json({ message: 'Se este email estiver cadastrado, enviaremos instruções em instantes.' });
      }

      console.error('Erro ao buscar usuário no Firebase Auth:', firebaseError);
      return res.status(500).json({ error: 'Erro interno ao buscar usuário' });
    }

    if (!userRecord.emailVerified) {
      return res.status(403).json({ error: 'Confirme seu email antes de solicitar a recuperação de senha.' });
    }

    // Passo 2: recuperar dados auxiliares para personalizar o email
    const userRef = db.collection('users').doc(emailLower);
    const userDoc = await userRef.get();
    const userData = userDoc.exists ? userDoc.data() : undefined;

    // Passo 3: gerar e enviar (ou logar) o link de recuperação
    try {
      await sendPasswordResetEmailMessage(emailLower, userData?.name || userRecord.displayName || undefined);
    } catch (emailError) {
      console.error('Erro ao enviar email de recuperação de senha:', emailError);
      return res.status(500).json({ error: 'Erro interno ao enviar email de recuperação' });
    }

    return res.status(200).json({ message: 'Se este email estiver cadastrado, enviaremos instruções em instantes.' });
  } catch (error) {
    console.error('Erro ao solicitar recuperação de senha:', error);
    return res.status(500).json({
      error: 'Erro interno ao solicitar recuperação de senha',
      message: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
}
