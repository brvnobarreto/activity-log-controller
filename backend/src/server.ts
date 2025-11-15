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
import path from "path";
import fs from "fs";
import authRoutes from "./routes/authRoutes.js";
import activityRoutes from "./routes/activityRoutes.js";
import employeeRoutes from "./routes/employeeRoutes.js";
import feedbackRoutes from "./routes/feedbackRoutes.js";

// Carregar variáveis de ambiente do arquivo .env
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const DEFAULT_DEV_URL = "http://localhost:3100";
const DEFAULT_PROD_URL = "https://activity-log-controller.onrender.com";

const rawFrontendUrl =
  process.env.FRONTEND_URL ||
  process.env.VITE_FRONTEND_URL ||
  process.env.APP_FRONTEND_URL ||
  null;

const isRenderEnvironment = Boolean(process.env.RENDER);
const isProductionNodeEnv = process.env.NODE_ENV === "production";
const isProduction =
  rawFrontendUrl !== null
    ? rawFrontendUrl.startsWith("http")
    : isRenderEnvironment || isProductionNodeEnv;

const frontendUrl =
  rawFrontendUrl ??
  (isProduction ? DEFAULT_PROD_URL : DEFAULT_DEV_URL);

// ============================================
// MIDDLEWARES GLOBAIS
// ============================================
// Morgan: loga requisições HTTP (método, URL, status, tempo)
app.use(morgan('dev'));
// CORS: permite requisições de outros domínios (frontend)
app.use(cors());
// JSON parser: converte JSON do body da requisição em objeto
// Aumenta o limite para suportar imagens em Base64 (~1 MB) vindas do frontend
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// ============================================
// ROTAS
// ============================================

// Rotas de autenticação 
app.use('/api/auth', authRoutes);
// Rotas de atividades 
app.use('/api/activities', activityRoutes);
// Rotas de funcionários 
app.use('/api/employees', employeeRoutes);
// Rotas de feedbacks 
app.use('/api/feedbacks', feedbackRoutes);

// ============================================
// SERVIDOR DE ARQUIVOS ESTÁTICOS (PRODUÇÃO)
// ============================================
// Em produção, serve os arquivos estáticos do frontend se disponível
if (isProduction) {
  const projectRoot = process.cwd();
  const frontendDistPath = path.resolve(projectRoot, 'frontend/dist');
  const indexPath = path.join(frontendDistPath, 'index.html');
  
  // Verifica se o frontend foi buildado e está disponível
  const frontendExists = fs.existsSync(indexPath);
  
  if (frontendExists) {
    console.log(`✓ Frontend encontrado em: ${frontendDistPath}`);
    // Serve arquivos estáticos (CSS, JS, imagens, etc.)
    app.use(express.static(frontendDistPath));
    
    // Fallback para SPA: todas as rotas que não são da API retornam index.html
    // Isso permite que o React Router faça o roteamento no cliente
    // Usa app.use ao invés de app.get('*') porque Express 5 não suporta mais wildcard simples
    app.use((req, res, next) => {
      // Ignora rotas da API
      if (req.path.startsWith('/api')) {
        return next();
      }
      // Ignora métodos que não são GET
      if (req.method !== 'GET') {
        return next();
      }
      // Serve index.html para todas as outras rotas GET
      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error('Erro ao servir index.html:', err);
          res.status(500).send('Erro ao carregar a aplicação');
        }
      });
    });
  } else {
    console.warn(`⚠ Frontend não encontrado em: ${frontendDistPath}`);
    console.warn('O backend servirá apenas a API. Use o serviço Static Site do frontend para servir os arquivos estáticos.');
    
    // Rota raiz informativa
    app.get('/', (_req, res) => {
      res.type('html').send(`<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Activity Log Controller – Backend</title>
    <style>
      :root { --background: #0f0f0f; --foreground: #f4f4f5; --muted: #a1a1aa; --primary: #22c55e; --link: #3b82f6; }
      body { background-color: var(--background); color: var(--foreground); font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 1rem; text-align: center; }
      h1 { font-size: 2rem; color: var(--primary); margin-bottom: 0.5rem; }
      p { font-size: 1rem; color: var(--muted); margin: 0.5rem 0; }
      code { background: rgba(255,255,255,0.1); padding: 0.2rem 0.4rem; border-radius: 4px; font-family: monospace; }
    </style>
  </head>
  <body>
    <h1>✅ Servidor disponível</h1>
    <p>Este é o servidor backend do Activity Log Controller.</p>
    <p>A API está disponível em <code>/api/*</code></p>
    <p>Use o serviço Static Site do frontend para acessar a interface web.</p>
  </body>
</html>`);
    });
    
    // Para outras rotas não-API, retorna 404
    app.use((req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      if (req.method === 'GET') {
        res.status(404).json({ 
          error: 'Not found',
          message: 'Frontend não está sendo servido por este servidor. Use o serviço Static Site do frontend.'
        });
      } else {
        next();
      }
    });
  }
} else {
  // Em desenvolvimento, apenas mostra a página de redirecionamento
  // Página inicial amigável para quem acessa diretamente o backend no navegador.
  app.get('/', (_req, res) => {
  res.type('html').send(`<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="refresh" content="3;url=${frontendUrl}" />
    <title>Activity Log Controller – Backend</title>
    <style>
      :root {
        color-scheme: light;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        background: radial-gradient(circle at top, #f8fafc 0%, #e2e8f0 40%, #cbd5f5 100%);
      }
      .card {
        max-width: 480px;
        width: 100%;
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(6px);
        border-radius: 16px;
        padding: 2.5rem 2rem;
        box-shadow: 0 25px 50px -12px rgba(30, 64, 175, 0.25);
        text-align: center;
        color: #1f2937;
      }
      h1 {
        margin: 0 0 0.75rem;
        font-size: clamp(1.8rem, 5vw, 2.25rem);
        font-weight: 700;
        color: #1d4ed8;
      }
      p {
        margin: 0 0 1.5rem;
        font-size: 1rem;
        line-height: 1.6;
        color: #4b5563;
      }
      a {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        text-decoration: none;
        background: linear-gradient(135deg, #2563eb, #1d4ed8);
        color: #fff;
        padding: 0.75rem 1.5rem;
        border-radius: 999px;
        font-weight: 600;
        transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
        box-shadow: 0 12px 30px -10px rgba(37, 99, 235, 0.5);
      }
      a:hover {
        transform: translateY(-2px);
        box-shadow: 0 20px 35px -15px rgba(29, 78, 216, 0.6);
        filter: brightness(1.05);
      }
      .hint {
        margin-top: 1rem;
        font-size: 0.875rem;
        color: #6b7280;
      }
    </style>
    <script>
      // Redirecionamento por JavaScript caso o meta refresh seja bloqueado.
      window.addEventListener('load', () => {
        const target = ${JSON.stringify(frontendUrl)};
        const timeoutId = setTimeout(() => {
          window.location.assign(target);
        }, 3000);
        document.getElementById('cta')?.addEventListener('click', () => clearTimeout(timeoutId));
      });
    </script>
  </head>
  <body>
    <main class="card">
      <h1>Você está no servidor</h1>
      <p>Este endereço é destinado à API do Activity Log Controller. Você será redirecionado em instantes para a interface web.</p>
      <a id="cta" href="${frontendUrl}" rel="noopener noreferrer">
        Ir para o aplicativo
        <span aria-hidden="true">↗</span>
      </a>
      <p class="hint">Redirecionando automaticamente em alguns segundos…</p>
    </main>
  </body>
</html>`);
  });
}

// ============================================
// INICIAR SERVIDOR
// ============================================
app.listen(port, () => {
    console.log(`Servidor rodando. Acesso em: http://localhost:${port}`);
});