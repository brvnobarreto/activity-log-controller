/**
 * ============================================
 * CONTROLADOR DE ATIVIDADES
 * ============================================
 *
 * Este arquivo define as funções responsáveis por receber as
 * requisições HTTP relacionadas às atividades e conversar com o
 * Firestore. É aqui que validamos os dados enviados pelo frontend,
 * salvamos novos registros e buscamos atividades já criadas.
 *
 * Funções exportadas:
 * - listActivities: devolve todas as atividades salvas (mais recentes primeiro)
 * - createActivity: cria um novo registro de atividade no Firestore
 */

import { Request, Response } from "express";
import type { DocumentData, DocumentSnapshot, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { db, FieldValue } from "../config/firebase.js";

// Nome da coleção no Firestore onde iremos guardar as atividades
const COLLECTION_NAME = "activities";

// Tipagem auxiliar para deixar o código mais fácil de entender
type ActivityInput = {
  nome?: string;
  name?: string;
  descricao?: string;
  descricaoOriginal?: string;
  nivel?: string;
  status?: string;
  localPrincipal?: string;
  subLocais?: string[];
  latitude?: number;
  longitude?: number;
  fotoUrl?: string;
  createdBy?: string;
  updatedBy?: string;
};

// Listas com os valores permitidos para nível e status (usadas na validação)
const VALID_LEVELS = ["Baixo", "Normal", "Alto", "Máximo"];
const VALID_STATUS = ["Pendente", "Concluído", "Não Concluído"];

/**
 * Converte o objeto salvo no Firestore para o formato de resposta da API.
 * Além de transformar o timestamp em string ISO, garante que sempre temos
 * as mesmas chaves no JSON retornado.
 */
function mapFirestoreData(doc: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>) {
  const data = doc.data();

  if (!data) {
    return {
      id: doc.id,
      nome: "Usuário",
      descricao: "",
      descricaoOriginal: "",
      nivel: "Normal",
      status: "Pendente",
      localPrincipal: null,
      subLocais: [],
      location: {
        latitude: null,
        longitude: null,
      },
      fotoUrl: null,
      createdAt: null,
    createdBy: null,
      updatedAt: null,
    };
  }

  return {
    id: doc.id,
    nome: data.nome ?? data.name ?? "Usuário",
    descricao: data.descricao ?? "",
    descricaoOriginal: data.descricaoOriginal ?? data.descricao ?? "",
    nivel: data.nivel ?? "Normal",
    status: data.status ?? "Pendente",
    localPrincipal: data.localPrincipal ?? null,
    subLocais: Array.isArray(data.subLocais) ? data.subLocais : [],
    location: {
      latitude: typeof data.location?.latitude === "number" ? data.location.latitude : null,
      longitude: typeof data.location?.longitude === "number" ? data.location.longitude : null,
    },
    fotoUrl: data.fotoUrl ?? null,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : null,
    createdBy: typeof data.createdBy === "string" ? data.createdBy : null,
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : null,
  };
}

/**
 * GET /api/activities
 *
 * Lista todas as atividades cadastradas no Firestore, ordenadas pela data
 * de criação (mais recentes primeiro). Ideal para preencher a tela inicial
 * de atividades no frontend.
 */
export async function listActivities(_req: Request, res: Response) {
  try {
    const snapshot = await db
      .collection(COLLECTION_NAME)
      .orderBy("createdAt", "desc")
      .get();

    const activities = snapshot.docs.map(mapFirestoreData);

    res.json({ activities });
  } catch (error) {
    console.error("Erro ao listar atividades:", error);
    res.status(500).json({ message: "Não foi possível buscar as atividades" });
  }
}

/**
 * POST /api/activities
 *
 * Recebe os dados enviados pelo frontend, faz uma validação direta
 * e salva tudo em uma coleção do Firestore. Devolve o objeto
 * recém-criado já com ID e data.
 */
export async function createActivity(req: Request, res: Response) {
  const {
    nome,
    name,
    descricao,
    descricaoOriginal,
    nivel,
    status,
    localPrincipal,
    subLocais,
    latitude,
    longitude,
    fotoUrl,
  } = req.body as ActivityInput;

  const fotoUrlNormalizada = typeof fotoUrl === "string" ? fotoUrl.trim() : "";

  if (!fotoUrlNormalizada) {
    return res.status(400).json({ message: "O campo 'fotoUrl' é obrigatório e deve ser informado." });
  }

  // =====================================================
  // VALIDAÇÃO BÁSICA DOS CAMPOS
  // =====================================================
  const descricaoNormalizada = typeof descricao === "string" ? descricao.trim() : "";
  const descricaoOriginalNormalizada = typeof descricaoOriginal === "string" && descricaoOriginal.trim().length > 0
    ? descricaoOriginal.trim()
    : descricaoNormalizada;

  if (!descricaoOriginalNormalizada) {
    return res.status(400).json({ message: "O campo 'descricao' é obrigatório." });
  }

  if (!nivel || !VALID_LEVELS.includes(nivel)) {
    return res.status(400).json({ message: "O campo 'nivel' é obrigatório e deve ser válido." });
  }

  if (!status || !VALID_STATUS.includes(status)) {
    return res.status(400).json({ message: "O campo 'status' é obrigatório e deve ser válido." });
  }

  // subLocais deve ser sempre um array, mesmo que vazio
  const subLocaisNormalizados = Array.isArray(subLocais)
    ? subLocais.filter((item) => typeof item === "string" && item.trim().length > 0)
    : [];

  // Para coordenadas, aceitamos número ou null (frontend pode não enviar)
  const latitudeValida = typeof latitude === "number" ? latitude : null;
  const longitudeValida = typeof longitude === "number" ? longitude : null;

  if (latitudeValida === null || longitudeValida === null) {
    return res.status(400).json({ message: "Os campos 'latitude' e 'longitude' são obrigatórios e devem ser válidos." });
  }

  const nomeNormalizado = [nome, name]
    .find((valor) => typeof valor === "string" && valor.trim().length > 0)
    ?.trim();

  const fallbackNome = typeof req.user?.email === "string" && req.user.email.trim().length > 0
    ? req.user.email
    : "Usuário";
  const createdBy = typeof req.user?.email === "string" && req.user.email.trim().length > 0
    ? req.user.email.trim()
    : null;

  const descricaoParaSalvar = descricaoNormalizada || descricaoOriginalNormalizada;

  const activityToSave = {
    nome: nomeNormalizado || fallbackNome,
    descricao: descricaoParaSalvar,
    descricaoOriginal: descricaoOriginalNormalizada,
    nivel,
    status,
    localPrincipal: localPrincipal?.trim() || null,
    subLocais: subLocaisNormalizados,
    location: {
      latitude: latitudeValida,
      longitude: longitudeValida,
    },
    fotoUrl: fotoUrlNormalizada,
    createdBy,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  try {
    const docRef = await db.collection(COLLECTION_NAME).add(activityToSave);
    const savedDoc = await docRef.get();

    return res.status(201).json({ activity: mapFirestoreData(savedDoc) });
  } catch (error) {
    console.error("Erro ao criar atividade:", error);
    return res.status(500).json({ message: "Não foi possível salvar a atividade" });
  }
}

/**
 * PUT /api/activities/:id
 *
 * Atualiza uma atividade existente no Firestore. Recebe os mesmos campos
 * do createActivity e substitui os valores do documento, mantendo o campo
 * createdAt intacto e registrando a data/hora da alteração em updatedAt.
 */
export async function updateActivity(req: Request, res: Response) {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: "O parâmetro 'id' é obrigatório." });
  }

  const docRef = db.collection(COLLECTION_NAME).doc(id);
  const snapshot = await docRef.get();

  if (!snapshot.exists) {
    return res.status(404).json({ message: "Atividade não encontrada." });
  }

  const currentData = snapshot.data() ?? {};

  const {
    nome,
    name,
    descricao,
    descricaoOriginal,
    nivel,
    status,
    localPrincipal,
    subLocais,
    latitude,
    longitude,
    fotoUrl,
  } = req.body as ActivityInput;

  const descricaoNormalizada = typeof descricao === "string" ? descricao.trim() : "";
  const descricaoOriginalNormalizada = typeof descricaoOriginal === "string" && descricaoOriginal.trim().length > 0
    ? descricaoOriginal.trim()
    : (descricaoNormalizada || currentData.descricaoOriginal || currentData.descricao || "");

  if (!descricaoOriginalNormalizada) {
    return res.status(400).json({ message: "O campo 'descricao' é obrigatório." });
  }

  const nivelFinal = typeof nivel === "string" && VALID_LEVELS.includes(nivel)
    ? nivel
    : currentData.nivel;

  if (!nivelFinal || !VALID_LEVELS.includes(nivelFinal)) {
    return res.status(400).json({ message: "O campo 'nivel' é obrigatório e deve ser válido." });
  }

  const statusFinal = typeof status === "string" && VALID_STATUS.includes(status)
    ? status
    : currentData.status;

  if (!statusFinal || !VALID_STATUS.includes(statusFinal)) {
    return res.status(400).json({ message: "O campo 'status' é obrigatório e deve ser válido." });
  }

  const subLocaisNormalizados = Array.isArray(subLocais)
    ? subLocais.filter((item) => typeof item === "string" && item.trim().length > 0)
    : Array.isArray(currentData.subLocais)
      ? currentData.subLocais
      : [];

  const latitudeValida = typeof latitude === "number"
    ? latitude
    : (typeof currentData.location?.latitude === "number" ? currentData.location.latitude : null);

  const longitudeValida = typeof longitude === "number"
    ? longitude
    : (typeof currentData.location?.longitude === "number" ? currentData.location.longitude : null);

  const nomeNormalizado = [nome, name]
    .find((valor) => typeof valor === "string" && valor.trim().length > 0)
    ?.trim()
    || currentData.nome
    || currentData.name
    || (typeof req.user?.email === "string" ? req.user.email : "Usuário");

  const localPrincipalFinal = typeof localPrincipal === "string" && localPrincipal.trim().length > 0
    ? localPrincipal.trim()
    : (typeof currentData.localPrincipal === "string" && currentData.localPrincipal.trim().length > 0
      ? currentData.localPrincipal
      : null);

  let fotoUrlFinal: string | null;
  if (typeof fotoUrl === "string") {
    const trimmed = fotoUrl.trim();
    fotoUrlFinal = trimmed.length > 0 ? trimmed : null;
  } else if (fotoUrl === null) {
    fotoUrlFinal = null;
  } else if (typeof currentData.fotoUrl === "string" && currentData.fotoUrl.trim().length > 0) {
    fotoUrlFinal = currentData.fotoUrl;
  } else {
    fotoUrlFinal = null;
  }

  if (latitudeValida === null || longitudeValida === null) {
    return res.status(400).json({ message: "Os campos 'latitude' e 'longitude' são obrigatórios e devem ser válidos." });
  }

  if (!fotoUrlFinal) {
    return res.status(400).json({ message: "O campo 'fotoUrl' é obrigatório e deve ser informado." });
  }

  const descricaoParaSalvar = descricaoNormalizada || descricaoOriginalNormalizada;

  try {
    await docRef.update({
      nome: nomeNormalizado,
      descricao: descricaoParaSalvar,
      descricaoOriginal: descricaoOriginalNormalizada,
      nivel: nivelFinal,
      status: statusFinal,
      localPrincipal: localPrincipalFinal,
      subLocais: subLocaisNormalizados,
      location: {
        latitude: latitudeValida,
        longitude: longitudeValida,
      },
      fotoUrl: fotoUrlFinal,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const updatedDoc = await docRef.get();

    return res.status(200).json({ activity: mapFirestoreData(updatedDoc) });
  } catch (error) {
    console.error("Erro ao atualizar atividade:", error);
    return res.status(500).json({ message: "Não foi possível atualizar a atividade" });
  }
}

/**
 * DELETE /api/activities/:id
 *
 * Remove uma atividade do Firestore. Caso o documento não exista, retorna 404.
 */
export async function deleteActivity(req: Request, res: Response) {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: "O parâmetro 'id' é obrigatório." });
  }

  try {
    const docRef = db.collection(COLLECTION_NAME).doc(id);
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      return res.status(404).json({ message: "Atividade não encontrada." });
    }

    await docRef.delete();

    return res.status(200).json({ message: "Atividade removida com sucesso." });
  } catch (error) {
    console.error("Erro ao remover atividade:", error);
    return res.status(500).json({ message: "Não foi possível remover a atividade" });
  }
}

