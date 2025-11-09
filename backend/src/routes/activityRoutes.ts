/**
 * ============================================
 * ROTAS DE ATIVIDADES
 * ============================================
 *
 * Este arquivo concentra todas as rotas HTTP relacionadas às atividades.
 * A ideia é ter um lugar simples onde conectamos as URLs com as funções
 * do controlador (`activityController`).
 *
 * Rotas disponíveis:
 * - GET /api/activities       → lista todas as atividades
 * - POST /api/activities      → cria uma nova atividade
 * - PUT /api/activities/:id   → atualiza uma atividade existente
 */

import { Router } from "express";
import { createActivity, deleteActivity, listActivities, updateActivity } from "../controllers/activityController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = Router();

// GET /api/activities → devolve todas as atividades cadastradas
router.get("/", authenticate, listActivities);

// POST /api/activities → cria um novo registro de atividade
router.post("/", authenticate, createActivity);

// PUT /api/activities/:id → atualiza um registro existente
router.put("/:id", authenticate, updateActivity);

// DELETE /api/activities/:id → remove um registro existente
router.delete("/:id", authenticate, deleteActivity);

export default router;

