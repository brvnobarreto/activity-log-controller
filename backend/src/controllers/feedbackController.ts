/**
 * ============================================
 * FEEDBACK CONTROLLER
 * ============================================
 *
 * Responsável por receber feedbacks de supervisores, persistir no Firestore
 * e encaminhar o conteúdo ao fiscal configurado.
 */

import { Request, Response } from "express";
import type { DocumentData, DocumentSnapshot, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { db, FieldValue } from "../config/firebase.js";

type FeedbackRequestBody = {
  subject?: string;
  contentHtml?: string;
  contentText?: string;
  activityId?: string;
  targetEmail?: string;
};

type UserData = {
  name?: string;
  email?: string;
  role?: unknown;
  perfil?: { role?: unknown } | null;
  profile?: { role?: unknown } | null;
  roles?: unknown;
};

function extractRoleFromStructure(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const extracted = extractRoleFromStructure(item);
      if (extracted) return extracted;
    }
    return null;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const directKeys = ["role", "primary", "nome"];
    for (const key of directKeys) {
      const raw = obj[key];
      if (typeof raw === "string" && raw.trim().length) {
        return raw.trim();
      }
    }
    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === "boolean" && val && key.trim().length) {
        return key.trim();
      }
    }
    for (const val of Object.values(obj)) {
      const extracted = extractRoleFromStructure(val);
      if (extracted) return extracted;
    }
  }
  return null;
}

function sanitizeHtml(html: string) {
  return html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
}

function normalizePlainText(html: string) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(p|div|br|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function resolveUserRole(data: UserData) {
  return (
    extractRoleFromStructure(data.role) ??
    extractRoleFromStructure(data.perfil?.role) ??
    extractRoleFromStructure(data.profile?.role) ??
    extractRoleFromStructure(data.roles)
  );
}

function getTimestampISO(value: unknown) {
  if (value && typeof value === "object" && "toDate" in (value as Record<string, unknown>)) {
    const date = (value as { toDate: () => Date }).toDate();
    return date.toISOString();
  }
  return null;
}

function isMissingIndexError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message ?? "";
  return message.includes("requires an index") || message.includes("FAILED_PRECONDITION");
}

function mapFeedbackDoc(doc: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>) {
  const data = doc.data() ?? {};
  return {
    id: doc.id,
    subject: typeof data.subject === "string" ? data.subject : "",
    contentHtml: typeof data.contentHtml === "string" ? data.contentHtml : "",
    contentText: typeof data.contentText === "string" ? data.contentText : "",
    authorEmail: typeof data.authorEmail === "string" ? data.authorEmail : "",
    authorName: typeof data.authorName === "string" ? data.authorName : "",
    activityId: typeof data.activityId === "string" ? data.activityId : null,
    targetEmail: typeof data.targetEmail === "string" ? data.targetEmail : null,
    createdAt: getTimestampISO(data.createdAt) ?? doc.createTime?.toDate().toISOString() ?? null,
  };
}

export async function submitFeedback(req: Request, res: Response) {
  try {
    if (!req.user?.email) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const { contentHtml, contentText, subject, activityId, targetEmail }: FeedbackRequestBody = req.body ?? {};

    if (!contentHtml || typeof contentHtml !== "string" || !contentHtml.trim().length) {
      return res.status(400).json({ error: "Conteúdo do feedback é obrigatório." });
    }

    const authorEmail = req.user.email.toLowerCase();
    const authorDoc = await db.collection("users").doc(authorEmail).get();
    const authorData = (authorDoc.exists ? (authorDoc.data() as UserData) : null) ?? {};

    const resolvedRole = resolveUserRole(authorData);

    if (!resolvedRole || resolvedRole.toLowerCase() !== "supervisor") {
      return res.status(403).json({ error: "Apenas supervisores podem enviar feedbacks." });
    }

    const normalizedActivityId = typeof activityId === "string" ? activityId.trim() : "";
    const normalizedTargetEmail = typeof targetEmail === "string" ? targetEmail.trim().toLowerCase() : "";

    if (!normalizedActivityId.length) {
      return res.status(400).json({ error: "O identificador da atividade é obrigatório." });
    }

    if (!normalizedTargetEmail.length) {
      return res.status(400).json({ error: "O email do fiscal responsável é obrigatório." });
    }

    const sanitizedHtml = sanitizeHtml(contentHtml);
    const plainText = typeof contentText === "string" && contentText.trim().length
      ? contentText.trim()
      : normalizePlainText(sanitizedHtml);

    const authorName =
      typeof authorData.name === "string" && authorData.name.trim().length
        ? authorData.name.trim()
        : authorEmail;

    const feedbackToSave = {
      subject: subject?.trim() || `Feedback do supervisor ${authorName}`,
      contentHtml: sanitizedHtml,
      contentText: plainText,
      authorEmail,
      authorName,
      activityId: normalizedActivityId,
      targetEmail: normalizedTargetEmail,
      createdAt: FieldValue.serverTimestamp(),
    };

    const createdRef = await db.collection("feedbacks").add(feedbackToSave);
    const createdDoc = await createdRef.get();

    return res.status(201).json({ feedback: mapFeedbackDoc(createdDoc) });
  } catch (error) {
    console.error("Erro ao enviar feedback:", error);
    return res.status(500).json({
      error: "Erro interno ao enviar feedback.",
      message: error instanceof Error ? error.message : "Erro desconhecido.",
    });
  }
}

export async function getLatestFeedback(req: Request, res: Response) {
  try {
    if (!req.user?.email) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const userDoc = await db.collection("users").doc(req.user.email.toLowerCase()).get();
    const userData = (userDoc.exists ? (userDoc.data() as UserData) : null) ?? {};
    const userRole = resolveUserRole(userData)?.toLowerCase();

    if (userRole !== "fiscal" && userRole !== "supervisor") {
      return res.status(403).json({ error: "Acesso não permitido." });
    }

    const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit ?? "1"), 10) || 1, 1), 10);

    const snapshot = await db
      .collection("feedbacks")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    const feedbacks = snapshot.docs.map(mapFeedbackDoc);

    return res.status(200).json({ feedbacks });
  } catch (error) {
    console.error("Erro ao buscar feedbacks:", error);
    return res.status(500).json({
      error: "Erro interno ao carregar feedbacks.",
      message: error instanceof Error ? error.message : "Erro desconhecido.",
    });
  }
}

export async function getFeedbackByActivity(req: Request, res: Response) {
  try {
    if (!req.user?.email) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const { activityId } = req.params;
    if (!activityId || !activityId.trim().length) {
      return res.status(400).json({ error: "Parâmetro 'activityId' é obrigatório." });
    }

    const requesterEmail = req.user.email.toLowerCase();

    let snapshot;
    try {
      // Consulta preferencial com ordenação (requer índice composto).
      snapshot = await db
        .collection("feedbacks")
        .where("activityId", "==", activityId.trim())
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();
    } catch (err) {
      if (!isMissingIndexError(err)) {
        throw err;
      }
      // Fallback sem índice: busca todos os feedbacks da atividade e ordena em memória.
      const all = await db
        .collection("feedbacks")
        .where("activityId", "==", activityId.trim())
        .get();
      const ordered = all.docs
        .map(mapFeedbackDoc)
        .sort((a, b) => {
          const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
          const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
          return tb - ta;
        });

      const first = ordered[0] ?? null;
      if (!first) {
        return res.status(200).json({ feedback: null });
      }

      const targetEmail = first.targetEmail?.toLowerCase() ?? null;
      const authorEmail = first.authorEmail?.toLowerCase() ?? null;
      const requesterEmail = req.user.email.toLowerCase();
      if (requesterEmail !== targetEmail && requesterEmail !== authorEmail) {
        return res.status(403).json({ error: "Acesso não permitido." });
      }

      return res.status(200).json({ feedback: first });
    }

    if (snapshot.empty) {
      return res.status(200).json({ feedback: null });
    }

    const doc = snapshot.docs[0];
    const mapped = mapFeedbackDoc(doc);
    const targetEmail = mapped.targetEmail?.toLowerCase() ?? null;
    const authorEmail = mapped.authorEmail?.toLowerCase() ?? null;

    if (requesterEmail !== targetEmail && requesterEmail !== authorEmail) {
      return res.status(403).json({ error: "Acesso não permitido." });
    }

    return res.status(200).json({ feedback: mapped });
  } catch (error) {
    console.error("Erro ao buscar feedback da atividade:", error);
    return res.status(500).json({
      error: "Erro interno ao carregar feedback da atividade.",
      message: error instanceof Error ? error.message : "Erro desconhecido.",
    });
  }
}

export async function listFeedbacksForTarget(req: Request, res: Response) {
  try {
    if (!req.user?.email) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const requesterEmail = req.user.email.toLowerCase();

    const snapshot = await db
      .collection("feedbacks")
      .where("targetEmail", "==", requesterEmail)
      .get();

    const feedbacks = snapshot.docs.map(mapFeedbackDoc);
    const activityIds = Array.from(
      new Set(
        feedbacks
          .map((feedback) => (typeof feedback.activityId === "string" ? feedback.activityId : null))
          .filter((value): value is string => Boolean(value && value.length > 0)),
      ),
    );

    return res.status(200).json({ activities: activityIds, feedbacks });
  } catch (error) {
    console.error("Erro ao listar feedbacks do fiscal:", error);
    return res.status(500).json({
      error: "Erro interno ao carregar feedbacks.",
      message: error instanceof Error ? error.message : "Erro desconhecido.",
    });
  }
}

