/**
 * ============================================
 * ROTAS DE FEEDBACK
 * ============================================
 */

import { Router } from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import {
  getFeedbackByActivity,
  getLatestFeedback,
  listFeedbacksForTarget,
  submitFeedback,
} from "../controllers/feedbackController.js";

const router = Router();

router.post("/", authenticate, submitFeedback);
router.get("/latest", authenticate, getLatestFeedback);
router.get("/activity/:activityId", authenticate, getFeedbackByActivity);
router.get("/mine", authenticate, listFeedbacksForTarget);

export default router;

