/**
 * ============================================
 * CONFIGURAÇÃO FIREBASE
 * ============================================
 * 
 * Este arquivo inicializa o Firebase Admin SDK no backend.
 * 
 * O que ele faz:
 * 1. Conecta ao Firebase usando credenciais do arquivo .env
 * 2. Inicializa o Firestore (banco de dados NoSQL)
 * 3. Inicializa o Firebase Auth (para login com Google)
 * 
 * Exports:
 * - db: Firestore database (para salvar/ler dados)
 * - auth: Firebase Auth (para verificar tokens do Google)
 * 
 * Variáveis de ambiente necessárias (.env):
 * - FIREBASE_PROJECT_ID
 * - FIREBASE_PRIVATE_KEY
 * - FIREBASE_CLIENT_EMAIL
 */

import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

// Inicializar Firebase Admin SDK apenas uma vez
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    })
  })
}

// Exportar Firestore (banco de dados)
export const db = admin.firestore();
// Exportar Firebase Auth (autenticação)
export const auth = admin.auth();

export default admin;