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
import fs from "fs";
import path from "path";

dotenv.config();

function getServiceAccountFromEnv() {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();

  if (projectId && privateKey && clientEmail) {
    return { projectId, privateKey, clientEmail };
  }
  return null;
}

function getServiceAccountFromFile() {
  const explicitPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  const candidatePaths = [
    explicitPath,
    path.resolve(process.cwd(), "backend/activity-log-controller-firebase-adminsdk-fbsvc-62d02d2e91.json"),
    path.resolve(process.cwd(), "activity-log-controller-firebase-adminsdk-fbsvc-62d02d2e91.json"),
  ].filter((p): p is string => Boolean(p));

  for (const filePath of candidatePaths) {
    try {
      if (fs.existsSync(filePath)) {
        const content = JSON.parse(fs.readFileSync(filePath, "utf8"));
        if (content?.project_id && content?.private_key && content?.client_email) {
          return {
            projectId: String(content.project_id),
            privateKey: String(content.private_key),
            clientEmail: String(content.client_email),
          };
        }
      }
    } catch {
      // fallback no-op
    }
  }

  return null;
}

// Inicializar Firebase Admin SDK apenas uma vez, com fallback para arquivo local
if (!admin.apps.length) {
  const fromEnv = getServiceAccountFromEnv();
  const fromFile = fromEnv ? null : getServiceAccountFromFile();

  const creds = fromEnv ?? fromFile;
  if (!creds) {
    throw new Error("Firebase Admin credentials not found. Configure env vars or a service account file.");
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: creds.projectId,
      privateKey: creds.privateKey,
      clientEmail: creds.clientEmail,
    }),
  });
}

// Exportar Firestore (banco de dados)
export const db = admin.firestore();
// Exportar Firebase Auth (autenticação)
export const auth = admin.auth();
// Exportar FieldValue para usar serverTimestamp()
export const FieldValue = admin.firestore.FieldValue;

export default admin;