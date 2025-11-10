/**
 * ============================================
 * ROTAS DE FUNCIONÁRIOS
 * ============================================
 */

import { Router } from "express";
import {
  createEmployee,
  deleteEmployee,
  listEmployees,
  updateEmployee,
} from "../controllers/employeeController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/", authenticate, listEmployees);
router.post("/", authenticate, createEmployee);
router.put("/:id", authenticate, updateEmployee);
router.delete("/:id", authenticate, deleteEmployee);

export default router;


