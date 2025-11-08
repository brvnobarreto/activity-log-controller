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

const router = Router();

router.get("/", listEmployees);
router.post("/", createEmployee);
router.put("/:id", updateEmployee);
router.delete("/:id", deleteEmployee);

export default router;


