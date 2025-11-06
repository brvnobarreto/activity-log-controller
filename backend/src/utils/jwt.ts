/**
 * ============================================
 * UTILITÁRIOS JWT (JSON Web Token)
 * ============================================
 * 
 * Este arquivo contém funções para trabalhar com tokens JWT:
 * - generateToken: cria um novo token JWT com dados do usuário
 * - verifyToken: verifica se um token é válido e não expirou
 * - decodeToken: decodifica um token sem verificar (apenas leitura)
 * - decodeTokenFull: decodifica token incluindo metadata (exp, iat)
 * 
 * O token JWT contém:
 * - uid: ID único do usuário
 * - email: email do usuário
 * - exp: data de expiração
 * - iat: data de criação
 * 
 * Tokens são usados para autenticar usuários em requisições protegidas.
 * O token expira após o tempo definido em JWT_EXPIRES_IN (padrão: 7 dias).
 */

import jwt, { Secret, SignOptions } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// Função para gerar um token JWT
export const generateToken = (payload: { uid: string, email: string }): string => {
  return jwt.sign(payload, JWT_SECRET as Secret, { expiresIn: JWT_EXPIRES_IN } as SignOptions);
};

// Função para verificar um token JWT
export const verifyToken = (token: string): { uid: string, email: string } => {
  try {
    return jwt.verify(token, JWT_SECRET as Secret) as { uid: string, email: string };
  } catch (error) {
    throw new Error("Token inválido");
  }
};

// Função para decodificar um token JWT
export const decodeToken = (token: string): { uid: string, email: string } => {
  try {
    return jwt.decode(token) as { uid: string, email: string };
  } catch (error) {
    throw new Error("Token inválido");
  }
};

// Função para obter payload completo do token (incluindo exp)
export const decodeTokenFull = (token: string): { uid: string, email: string, exp?: number, iat?: number } => {
  try {
    return jwt.decode(token) as { uid: string, email: string, exp?: number, iat?: number };
  } catch (error) {
    throw new Error("Token inválido");
  }
};

export default { generateToken, verifyToken, decodeToken, decodeTokenFull };