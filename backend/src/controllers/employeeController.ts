/**
 * ============================================
 * CONTROLADOR DE FUNCIONÁRIOS
 * ============================================
 *
 * Responsável por lidar com as operações CRUD de funcionários
 * utilizando o Firestore como base de dados.
 */

import { Request, Response } from "express";
import type { DocumentData, DocumentSnapshot, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { db, FieldValue, auth } from "../config/firebase.js";

type EmployeeInput = {
  nomeCompleto?: string;
  matricula?: string;
  funcao?: string;
  fotoUrl?: string | null;
};

type FirestoreDoc = QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>;

const DEFAULT_COLLECTION = "employees";
const FALLBACK_COLLECTION = "funcionarios";

const WRITE_COLLECTION_OPTIONS = Array.from(
  new Set(
    [process.env.EMPLOYEE_COLLECTION?.trim(), DEFAULT_COLLECTION, FALLBACK_COLLECTION].filter(
      (value): value is string => Boolean(value && value.length > 0),
    ),
  ),
);

const READ_COLLECTION_OPTIONS = Array.from(
  new Set([
    ...WRITE_COLLECTION_OPTIONS,
    "users",
    "usuarios",
    "colaboradores",
    "funcionarios_cadastrados",
  ].filter((value): value is string => Boolean(value && value.length > 0))),
);

let cachedWriteCollection: string | null = null;
const employeeCollectionCache = new Map<string, string>();

function rememberCollection(id: string, collection: string) {
  employeeCollectionCache.set(id, collection);
  if (!cachedWriteCollection && WRITE_COLLECTION_OPTIONS.includes(collection)) {
    cachedWriteCollection = collection;
  }
}

function normalizeToString(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return "";
}

function pickFirstNonEmpty(values: unknown[]) {
  for (const value of values) {
    const normalized = normalizeToString(value);
    if (normalized.length > 0) {
      return normalized;
    }
  }

  return "";
}

function getValueByPath(data: Record<string, any>, path: string): unknown {
  try {
    const parts = path.split(".");
    let current: any = data;
    for (const part of parts) {
      if (current == null) return undefined;
      if (Array.isArray(current)) {
        const index = Number(part);
        current = Number.isFinite(index) ? current[index] : undefined;
      } else {
        current = current[part];
      }
    }
    return current;
  } catch {
    return undefined;
  }
}

function extractString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "";
  if (Array.isArray(value)) {
    for (const item of value) {
      const s = extractString(item);
      if (s) return s;
    }
    return "";
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const preferredKeys = [
      "name",
      "displayName",
      "label",
      "role",
      "cargo",
      "funcao",
      "position",
      "title",
      "primary",
    ];
    for (const key of preferredKeys) {
      if (key in obj) {
        const s = extractString(obj[key]);
        if (s) return s;
      }
    }
    // Caso comum: objeto de flags { fiscal: true, admin: false }
    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === "boolean" && val) return key;
    }
    // Último recurso: primeira string encontrada
    for (const val of Object.values(obj)) {
      const s = extractString(val);
      if (s) return s;
    }
  }
  return "";
}

function mapEmployeeDoc(doc: FirestoreDoc) {
  const data = doc.data() ?? {};

  const nomeCompleto = pickFirstNonEmpty([
    data.nomeCompleto,
    data.nome,
    data.name,
    data.displayName,
    data.fullName,
  ]);

  const matricula = pickFirstNonEmpty([
    data.matricula,
    data.matriculaId,
    data.registration,
    data.numeroMatricula,
  ]);

  // Tentar extrair função de vários campos/sinônimos e caminhos aninhados
  const funcaoCandidates: unknown[] = [
    data.funcao,
    data.cargo,
    data.role,
    data.function,
    data.position,
    data.papel,
    data.perfil,
    data.tipo,
    data.nivel,
    data.nivelAcesso,
    getValueByPath(data, "role.name"),
    getValueByPath(data, "cargo.nome"),
    getValueByPath(data, "profile.role"),
    getValueByPath(data, "perfil.role"),
    getValueByPath(data, "roles.primary"),
    getValueByPath(data, "roles.0"),
    getValueByPath(data, "permissions.role"),
    getValueByPath(data, "permissoes.role"),
    getValueByPath(data, "permissoes.funcao"),
    getValueByPath(data, "access.role"),
  ];
  let funcao = "";
  for (const candidate of funcaoCandidates) {
    const s = extractString(candidate);
    if (s) {
      funcao = s;
      break;
    }
  }

  const fotoUrl = pickFirstNonEmpty([data.fotoUrl, data.photoURL, data.avatarUrl, data.avatar]);

  const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : null;
  const updatedAt = data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : null;

  return {
    id: doc.id,
    nomeCompleto: nomeCompleto || "Funcionário",
    matricula: matricula,
    funcao: funcao,
    fotoUrl: fotoUrl || null,
    createdAt,
    updatedAt,
  };
}

function sortEmployeesByDate(employees: ReturnType<typeof mapEmployeeDoc>[]) {
  return employees.sort((a, b) => {
    const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
    const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;

    if (Number.isNaN(aTime) && Number.isNaN(bTime)) {
      return a.nomeCompleto.localeCompare(b.nomeCompleto, "pt-BR");
    }

    if (Number.isNaN(aTime)) return 1;
    if (Number.isNaN(bTime)) return -1;

    return bTime - aTime;
  });
}

function isMissingIndexError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message ?? "";
  return message.includes("requires an index") || message.includes("FAILED_PRECONDITION");
}

async function getCollectionSnapshot(collectionName: string) {
  try {
    return await db.collection(collectionName).orderBy("createdAt", "desc").get();
  } catch (error) {
    if (isMissingIndexError(error)) {
      return await db.collection(collectionName).get();
    }
    throw error;
  }
}

async function findEmployeeDocument(id: string) {
  const cachedCollection = employeeCollectionCache.get(id);
  if (cachedCollection) {
    const docRef = db.collection(cachedCollection).doc(id);
    const snapshot = await docRef.get();
    if (snapshot.exists) {
      cachedWriteCollection = cachedCollection;
      return { docRef, snapshot, collectionName: cachedCollection };
    }
    employeeCollectionCache.delete(id);
  }

  for (const collectionName of READ_COLLECTION_OPTIONS) {
    const docRef = db.collection(collectionName).doc(id);
    const snapshot = await docRef.get();
    if (snapshot.exists) {
      rememberCollection(id, collectionName);
      return { docRef, snapshot, collectionName };
    }
  }

  return null;
}

async function resolveWriteCollection() {
  if (cachedWriteCollection) {
    return cachedWriteCollection;
  }

  for (const collectionName of WRITE_COLLECTION_OPTIONS) {
    const snapshot = await db.collection(collectionName).limit(1).get();
    if (!snapshot.empty) {
      cachedWriteCollection = collectionName;
      return collectionName;
    }
  }

  cachedWriteCollection = WRITE_COLLECTION_OPTIONS[0] ?? DEFAULT_COLLECTION;
  return cachedWriteCollection;
}

export async function listEmployees(_req: Request, res: Response) {
  try {
    const employeesMap = new Map<string, ReturnType<typeof mapEmployeeDoc>>();

    for (const collectionName of READ_COLLECTION_OPTIONS) {
      const snapshot = await getCollectionSnapshot(collectionName);

      snapshot.forEach((doc) => {
        const mapped = mapEmployeeDoc(doc);
        employeesMap.set(mapped.id, mapped);
        rememberCollection(mapped.id, collectionName);
      });
    }

    let employees = sortEmployeesByDate(Array.from(employeesMap.values()));

    // Fallback: se nenhuma coleção do Firestore tiver documentos, tentar listar usuários do Firebase Auth
    if (employees.length === 0) {
      try {
        const authUsers = await auth.listUsers();
        const enriched = await Promise.all(
          authUsers.users.map(async (user) => {
            const emailLower = user.email?.toLowerCase();
            let firestoreRole: string | undefined;
            try {
              if (emailLower) {
                const userDoc = await db.collection("users").doc(emailLower).get();
                if (userDoc.exists) {
                  const data = userDoc.data() ?? {};
                  const roleCandidate = extractString(
                    getValueByPath(data, "role") ??
                      getValueByPath(data, "perfil.role") ??
                      getValueByPath(data, "roles.primary") ??
                      getValueByPath(data, "roles.0") ??
                      getValueByPath(data, "cargo.nome") ??
                      data.cargo ?? data.funcao
                  );
                  if (roleCandidate) firestoreRole = roleCandidate;
                }
              }
            } catch {
              // ignore errors reading user profile
            }

            const funcaoFinal =
              firestoreRole ||
              (user.customClaims?.funcao as string | undefined) ||
              (user.customClaims?.role as string | undefined) ||
              "--";

            return {
              id: user.uid,
              nomeCompleto: (user.displayName || user.email || "Funcionário").trim(),
              matricula: (user.customClaims?.matricula as string | undefined) || "--",
              funcao: funcaoFinal,
              fotoUrl: user.photoURL || null,
              createdAt: user.metadata?.creationTime || null,
              updatedAt: user.metadata?.lastSignInTime || null,
            };
          })
        );
        employees = sortEmployeesByDate(enriched);
      } catch (authErr) {
        // Mantém vazio caso Auth também não resolva
        console.error("Fallback Auth users falhou:", authErr);
      }
    }

    return res.json({ employees });
  } catch (error) {
    console.error("Erro ao listar funcionários:", error);
    return res.status(500).json({ message: "Não foi possível buscar os funcionários." });
  }
}

export async function createEmployee(req: Request, res: Response) {
  const { nomeCompleto, matricula, funcao, fotoUrl } = req.body as EmployeeInput;

  const nomeCompletoNormalizado = normalizeToString(nomeCompleto);
  const matriculaNormalizada = normalizeToString(matricula);
  const funcaoNormalizada = normalizeToString(funcao);
  const fotoUrlNormalizada = normalizeToString(fotoUrl);

  if (!nomeCompletoNormalizado) {
    return res.status(400).json({ message: "O campo 'nomeCompleto' é obrigatório." });
  }

  if (!matriculaNormalizada) {
    return res.status(400).json({ message: "O campo 'matricula' é obrigatório." });
  }

  if (!funcaoNormalizada) {
    return res.status(400).json({ message: "O campo 'funcao' é obrigatório." });
  }

  const employeeToSave = {
    nomeCompleto: nomeCompletoNormalizado,
    matricula: matriculaNormalizada,
    funcao: funcaoNormalizada,
    fotoUrl: fotoUrlNormalizada || null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  try {
    const collectionName = await resolveWriteCollection();
    const docRef = await db.collection(collectionName).add(employeeToSave);
    const savedDoc = await docRef.get();

    rememberCollection(savedDoc.id, collectionName);

    return res.status(201).json({ employee: mapEmployeeDoc(savedDoc) });
  } catch (error) {
    console.error("Erro ao criar funcionário:", error);
    return res.status(500).json({ message: "Não foi possível salvar o funcionário." });
  }
}

export async function updateEmployee(req: Request, res: Response) {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: "O parâmetro 'id' é obrigatório." });
  }

  const found = await findEmployeeDocument(id);

  if (!found) {
    return res.status(404).json({ message: "Funcionário não encontrado." });
  }

  const { docRef, collectionName } = found;
  const { nomeCompleto, matricula, funcao, fotoUrl } = req.body as EmployeeInput;

  const nomeCompletoNormalizado = normalizeToString(nomeCompleto);
  const matriculaNormalizada = normalizeToString(matricula);
  const funcaoNormalizada = normalizeToString(funcao);
  const fotoUrlNormalizada = normalizeToString(fotoUrl);

  if (!nomeCompletoNormalizado) {
    return res.status(400).json({ message: "O campo 'nomeCompleto' é obrigatório." });
  }

  if (!matriculaNormalizada) {
    return res.status(400).json({ message: "O campo 'matricula' é obrigatório." });
  }

  if (!funcaoNormalizada) {
    return res.status(400).json({ message: "O campo 'funcao' é obrigatório." });
  }

  try {
    await docRef.update({
      nomeCompleto: nomeCompletoNormalizado,
      matricula: matriculaNormalizada,
      funcao: funcaoNormalizada,
      fotoUrl: fotoUrlNormalizada || null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const updatedDoc = await docRef.get();
    rememberCollection(updatedDoc.id, collectionName);

    return res.json({ employee: mapEmployeeDoc(updatedDoc) });
  } catch (error) {
    console.error("Erro ao atualizar funcionário:", error);
    return res.status(500).json({ message: "Não foi possível atualizar o funcionário." });
  }
}

export async function deleteEmployee(req: Request, res: Response) {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: "O parâmetro 'id' é obrigatório." });
  }

  const found = await findEmployeeDocument(id);

  if (!found) {
    return res.status(404).json({ message: "Funcionário não encontrado." });
  }

  const { docRef } = found;

  try {
    await docRef.delete();
    employeeCollectionCache.delete(id);
    return res.status(204).send();
  } catch (error) {
    console.error("Erro ao remover funcionário:", error);
    return res.status(500).json({ message: "Não foi possível remover o funcionário." });
  }
}

