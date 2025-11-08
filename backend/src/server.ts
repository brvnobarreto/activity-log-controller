/**
 * ============================================
 * SERVIDOR EXPRESS
 * ============================================
 * 
 * Este é o arquivo principal do servidor. Ele:
 * 1. Configura o Express
 * 2. Configura middlewares (CORS, JSON parser)
 * 3. Registra todas as rotas
 * 4. Inicia o servidor na porta definida
 * 
 * Estrutura:
 * - Middlewares globais (CORS, JSON)
 * - Rotas públicas (health check)
 * - Rotas de autenticação (/api/auth/*)
 * 
 * Para iniciar: npm run dev
 * Para testar: http://localhost:3001/api/health
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import morgan from "morgan";
import authRoutes from "./routes/authRoutes.js";
import activityRoutes from "./routes/activityRoutes.js";
import employeeRoutes from "./routes/employeeRoutes.js";

// Carregar variáveis de ambiente do arquivo .env
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// ============================================
// MIDDLEWARES GLOBAIS
// ============================================
// Morgan: loga requisições HTTP (método, URL, status, tempo)
app.use(morgan('dev'));
// CORS: permite requisições de outros domínios (frontend)
app.use(cors());
// JSON parser: converte JSON do body da requisição em objeto
// Aumentamos o limite para suportar imagens em Base64 (~1 MB) vindas do frontend
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// ============================================
// ROTAS
// ============================================
// Rota de health check (verificar se API está funcionando)
app.get('/api/health', (req, res) => {
  res.json({ message: "API está funcionando corretamente" });
});

// Rotas de autenticação (prefixo: /api/auth)
app.use('/api/auth', authRoutes);
// Rotas de atividades (prefixo: /api/activities)
app.use('/api/activities', activityRoutes);
// Rotas de funcionários (prefixo: /api/employees)
app.use('/api/employees', employeeRoutes);

// ============================================
// INICIAR SERVIDOR
// ============================================
app.listen(port, () => {
    console.log(`Servidor rodando. Acesso em: http://localhost:${port}`);
});