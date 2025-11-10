// TELA: Atividades - gerenciamento completo das ocorrências e formulários da operação
import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import axios from "axios";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, MapPin, Plus, Trash2, MessageCircle, CheckCircle, Clock, XCircle, Pencil, MoreVertical, Loader2, Download } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/Auth/context/AuthContext";
import {
  type ActivityScope,
  type Atividade,
  type NivelAtividade,
  type StatusAtividade,
  isNivelAtividade,
  isStatusAtividade,
  useActivityContext,
} from "@/context/ActivityContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getSessionToken } from "@/Auth/utils/sessionStorage";
import { buildApiUrl, resolveApiBaseUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

type FeedbackEntry = {
  id: string;
  subject: string;
  contentHtml: string;
  contentText: string;
  authorEmail: string;
  authorName: string;
  createdAt: string | null;
  activityId?: string | null;
};

type AtividadesProps = {
  title?: string;
  filterByCurrentUser?: boolean;
  autoOpenNew?: boolean;
};

// Normaliza campos de role que podem vir como string, array ou objeto
// e retorna um array com todos os valores em minúsculas para facilitar comparação.
function normalizeRoleValue(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized.length ? [normalized] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeRoleValue(item));
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const fromValues = Object.values(obj).flatMap((item) => normalizeRoleValue(item));
    const fromBooleanKeys = Object.entries(obj)
      .filter(([, val]) => typeof val === "boolean" && val)
      .map(([key]) => key.trim().toLowerCase())
      .filter((key) => key.length > 0);
    return [...fromValues, ...fromBooleanKeys];
  }
  return [];
}

// Verifica se o usuário possui um determinado papel, mesmo que ele esteja guardado
// em formatos diferentes (string única, array ou objeto). Isso evita falhas quando
// o backend muda o formato do campo de permissão.
function userHasRole(user: { role?: unknown; perfil?: { role?: unknown } | null; profile?: { role?: unknown } | null; roles?: unknown } | null | undefined, role: string) {
  const target = role.trim().toLowerCase();
  if (!target.length) return false;

  const roleValues = [
    ...normalizeRoleValue(user?.role),
    ...normalizeRoleValue(user?.perfil?.role),
    ...normalizeRoleValue(user?.profile?.role),
    ...normalizeRoleValue(user?.roles),
  ];

  return roleValues.some((value) => value.includes(target));
}

function formatDayLabel(dateValue: string | null | undefined) {
  if (!dateValue) {
    return "Hoje";
  }

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return "Hoje";
  }

  const label = date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });

  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatDateTime(dateValue: string | null | undefined) {
  if (!dateValue) return "--";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateOnly(dateValue: string | null | undefined) {
  if (!dateValue) return "--";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTimeOnly(dateValue: string | null | undefined) {
  if (!dateValue) return "--";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const NIVEL_EXCEL_COLORS: Record<NivelAtividade, string> = {
  Baixo: "FF22C55E",
  Normal: "FF3B82F6",
  Alto: "FFF97316",
  Máximo: "FFEF4444",
};

// Agrupa atividades por dia de criação para facilitar a renderização da lista.
// O Map mantém a ordem de inserção e permite ler a quantidade de registros por data.
function groupActivitiesByDay(list: Atividade[]) {
  const grouped = new Map<string, Atividade[]>();

  list.forEach((activity) => {
    const label = formatDayLabel(activity.createdAt);
    const current = grouped.get(label) ?? [];
    grouped.set(label, [...current, activity]);
  });

  return grouped;
}

// Função auxiliar para obter a cor do nível
function getNivelColor(nivel: NivelAtividade): string {
  switch (nivel) {
    case 'Máximo':
      return 'bg-red-500';
    case 'Alto':
      return 'bg-orange-500';
    case 'Normal':
      return 'bg-blue-500';
    case 'Baixo':
      return 'bg-green-500';
    default:
      return 'bg-gray-500';
  }
}

// Função auxiliar para obter o ícone do status
function getStatusIcon(status: StatusAtividade) {
  switch (status) {
    case 'Concluído':
      return <CheckCircle className="h-5 w-5 text-green-600" aria-label="Status: Concluído" />;
    case 'Pendente':
      return <Clock className="h-5 w-5 text-yellow-600" aria-label="Status: Pendente" />;
    case 'Não Concluído':
      return <XCircle className="h-5 w-5 text-red-600" aria-label="Status: Não Concluído" />;
    default:
      return null;
  }
}

type LocalOption = {
  id: string;
  nome: string;
  termos: string[];
};

function buildLocalOption(id: string, nome: string, extraTerms: string[] = []): LocalOption {
  const normalized = id.replace(/_/g, " ");
  const normalizedNoSpaces = normalized.replace(/\s+/g, "");
  const baseTerms = [nome.toLowerCase(), normalized, normalizedNoSpaces, ...extraTerms.map((term) => term.toLowerCase())]
    .filter(Boolean);
  const termos = Array.from(new Set(baseTerms));
  return { id, nome, termos };
}

const BLOCO_M_ID = "bloco_m";
const blocosDisponiveis = ["M"];

// Limites configurados para garantir que o documento do Firestore fique abaixo de 1 MB.
// Consideramos que o Base64 aumenta o tamanho em ~33%, então trabalhamos com margem.
const MAX_IMAGE_BYTES = 650_000;
const MAX_DATA_URL_LENGTH = 900_000;
const MAX_IMAGE_DIMENSION = 1280;
const IMAGE_QUALITY_START = 0.9;
const IMAGE_QUALITY_MIN = 0.5;
const IMAGE_QUALITY_STEP = 0.05;

function revokePreview(preview: string | null) {
  if (preview && preview.startsWith("blob:")) {
    URL.revokeObjectURL(preview);
  }
}

function estimateDataUrlSize(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex === -1) {
    return 0;
  }

  const base64String = dataUrl.slice(commaIndex + 1);
  const padding = base64String.endsWith("==") ? 2 : base64String.endsWith("=") ? 1 : 0;
  return Math.ceil((base64String.length * 3) / 4) - padding;
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 KB";
  return `${(bytes / 1024).toFixed(1)} KB`;
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Não foi possível ler o arquivo selecionado."));
      }
    };
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo selecionado."));
    reader.readAsDataURL(file);
  });
}

function calculateTargetDimensions(width: number, height: number): { width: number; height: number } {
  const ratio = Math.min(MAX_IMAGE_DIMENSION / Math.max(width, 1), MAX_IMAGE_DIMENSION / Math.max(height, 1), 1);
  const targetWidth = Math.max(1, Math.round(width * ratio));
  const targetHeight = Math.max(1, Math.round(height * ratio));
  return { width: targetWidth, height: targetHeight };
}

async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Não foi possível carregar a imagem selecionada."));
    };
    img.src = objectUrl;
  });
}

async function compressImageFile(file: File): Promise<{ dataUrl: string; size: number }> {
  const originalDataUrl = await fileToDataUrl(file);
  const originalSize = estimateDataUrlSize(originalDataUrl);
  const originalLength = originalDataUrl.length;

  if (originalSize <= MAX_IMAGE_BYTES && originalLength <= MAX_DATA_URL_LENGTH) {
    return { dataUrl: originalDataUrl, size: originalSize };
  }

  const image = await loadImageFromFile(file);
  const { width, height } = calculateTargetDimensions(image.width, image.height);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Não foi possível preparar o contexto de desenho da imagem.");
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, width, height);

  let quality = IMAGE_QUALITY_START;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  let size = estimateDataUrlSize(dataUrl);
  let length = dataUrl.length;

  while ((size > MAX_IMAGE_BYTES || length > MAX_DATA_URL_LENGTH) && quality > IMAGE_QUALITY_MIN) {
    quality = Math.max(quality - IMAGE_QUALITY_STEP, IMAGE_QUALITY_MIN);
    dataUrl = canvas.toDataURL("image/jpeg", quality);
    size = estimateDataUrlSize(dataUrl);
    length = dataUrl.length;
  }

  if (size > MAX_IMAGE_BYTES || length > MAX_DATA_URL_LENGTH) {
    throw new Error("A imagem continua grande demais. Escolha um arquivo menor (recomendado < 700 KB).");
  }

  return { dataUrl, size };
}

const pavimentosBlocoM: LocalOption[] = [
  buildLocalOption("terreo", "Térreo"),
  buildLocalOption("primeiro_andar", "Primeiro Andar"),
  buildLocalOption("segundo_andar", "Segundo Andar"),
];

const areasBlocoM: LocalOption[] = [
  buildLocalOption("area_livre", "Área Livre"),
  buildLocalOption("banheiros", "Banheiros"),
  buildLocalOption("laboratorio", "Laboratório"),
  buildLocalOption("sala_aula", "Sala de Aula"),
];

const areasDisponiveis: LocalOption[] = [
  buildLocalOption("reitoria", "Reitoria"),
  buildLocalOption("espaco_cultura", "Espaço Cultura Unifor", ["espaco cultura"]),
  buildLocalOption("vice_extensao", "Vice Reitoria de Extensão", ["vice reitoria de extensao"]),
  buildLocalOption("vice_graduacao", "Vice Reitoria de Graduação", ["vice reitoria de graduacao"]),
  buildLocalOption("sucesso_aluno", "Sucesso do Aluno"),
  buildLocalOption("biblioteca", "Biblioteca"),
  buildLocalOption("teatro_celina", "Teatro Celina Queiroz", ["teatro celina"]),
  buildLocalOption("centro_convivencia", "Centro de Convivência", ["centro de convivencia"]),
  buildLocalOption("ginasio", "Ginásio Poliesportivo", ["ginasio", "ginásio"]),
  buildLocalOption("divisao_esportes", "Divisão de Atividades Desportivas", ["divisao de atividades desportivas"]),
  buildLocalOption("clinica_odontologia", "Clínica Integrada de Odontologia", ["clinica integrada de odontologia"]),
  buildLocalOption("prefeitura", "Prefeitura"),
  buildLocalOption("academia", "Academia Unifor", ["academia"]),
  buildLocalOption("escritorio_juridico", "Escritório de Prática Jurídica", ["escritorio de pratica juridica"]),
  buildLocalOption("nami", "Núcleo de Atenção Médica Integrada (NAMI)", ["nucleo de atencao medica integrada", "nami"]),
  buildLocalOption("pos_graduacao", "Pós-Graduação", ["pos graduacao"]),
  buildLocalOption("painel_solar", "Painéis Solares", ["painel solar"]),
  buildLocalOption("auditorio", "Auditório", ["auditorio"]),
  buildLocalOption("estacionamento", "Estacionamento"),
];

const subLocaisDisponiveis: LocalOption[] = [
  buildLocalOption("laboratorio", "Laboratório", ["laboratorio", "laboratorios", "laboratórios"]),
  buildLocalOption("corredor", "Corredor"),
  buildLocalOption("area_externa", "Área Externa", ["area externa"]),
  buildLocalOption("sala_aula", "Sala de Aula", ["sala de aula", "salas de aula", "sala", "salas"]),
];

const locaisDisponiveis: LocalOption[] = [
  ...blocosDisponiveis.map((bloco) =>
    buildLocalOption(`bloco_${bloco.toLowerCase()}`, `Bloco ${bloco}`, [`bloco ${bloco.toLowerCase()}`, `bloco ${bloco}`])
  ),
  ...areasDisponiveis,
];

function getBlocoMSubLocalKey(pavimentoId: string, areaId: string) {
  return `${BLOCO_M_ID}__${pavimentoId}__${areaId}`;
}

function getBlocoMSubLocalLabel(pavimentoNome: string, areaNome: string) {
  return `Bloco M - ${pavimentoNome} - ${areaNome}`;
}

// Fonte de dados e filtros são fornecidos por ActivityContext.

export default function Atividades({ title, filterByCurrentUser, autoOpenNew = false }: AtividadesProps = {}) {
  const isMobile = useIsMobile();
  const { sessionUser } = useAuth();
  const isFiscal = userHasRole(sessionUser, "fiscal");
  const isSupervisor = userHasRole(sessionUser, "supervisor");
  const apiBaseUrl = resolveApiBaseUrl();
  const effectiveFilterByCurrentUser = filterByCurrentUser ?? isFiscal;
  const effectiveTitle = title ?? "Registro de atividades";
  const location = useLocation();
  const navigate = useNavigate();
  // O contexto centraliza as operações de CRUD e o cache das atividades
  const {
    activities: globalActivities,
    personalActivities,
    isLoading,
    createActivity,
    updateActivity,
    deleteActivity,
  } = useActivityContext();

  const normalizedUserEmail = useMemo(
    () => (sessionUser?.email ? sessionUser.email.trim().toLowerCase() : ""),
    [sessionUser?.email],
  );

  const isActivityOwnedByUser = useCallback(
    (activity: Atividade) => {
      const createdByNorm =
        typeof activity.createdBy === "string" && activity.createdBy.trim().length > 0
          ? activity.createdBy.trim().toLowerCase()
          : "";
      return createdByNorm.length > 0 && createdByNorm === normalizedUserEmail;
    },
    [normalizedUserEmail],
  );

  // IDs de atividades com feedback destinado ao fiscal logado (obtidos via /api/feedbacks/mine).
  const [feedbackActivityMap, setFeedbackActivityMap] = useState<Record<string, boolean>>({});
  const [targetedActivityIndex, setTargetedActivityIndex] = useState<Record<string, true>>({});

  const scope: ActivityScope = effectiveFilterByCurrentUser ? "personal" : "global";

  // Define a lista base (global ou pessoal) dependendo das props da tela
  const baseActivities = useMemo(
    () => (effectiveFilterByCurrentUser ? personalActivities : globalActivities),
    [effectiveFilterByCurrentUser, personalActivities, globalActivities],
  );

  // Fiscal: deve ver
  // - suas próprias atividades (createdBy ~ email logado), e
  // - atividades com feedback direcionado a ele (targetEmail == email logado).
  // Unimos ambos os conjuntos preservando a ordem base e evitando duplicidade.
  const activities = useMemo(() => {
    if (!isFiscal) return baseActivities;
    const targetedIds = targetedActivityIndex;
    const merged = new Map<string, Atividade>();
    // Sempre começa pela base (pessoal ou global, conforme tela)
    for (const item of baseActivities) {
      merged.set(item.id, item);
    }
    // Garante que todas as pessoais apareçam
    for (const item of personalActivities) {
      merged.set(item.id, item);
    }
    // Inclui as com feedback direcionado (que podem não ser do próprio fiscal)
    for (const item of globalActivities) {
      if (targetedIds[item.id]) {
        merged.set(item.id, item);
      }
    }
    return Array.from(merged.values());
  }, [baseActivities, globalActivities, isFiscal, personalActivities, targetedActivityIndex]);

  const groupedActivities = useMemo(() => groupActivitiesByDay(activities), [activities]);
  const groupedEntries = useMemo(() => Array.from(groupedActivities.entries()), [groupedActivities]);
  const totalAtividades = activities.length;
  const mediaSemanal = groupedEntries.length ? Math.round(totalAtividades / groupedEntries.length) : totalAtividades;

  const isLoadingActivities = isLoading;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [nivel, setNivel] = useState<NivelAtividade | "">("");
  const [status, setStatus] = useState<StatusAtividade | "">("");
  const [lat, setLat] = useState<number | "">("");
  const [lng, setLng] = useState<number | "">("");
  const [latInput, setLatInput] = useState("");
  const [lngInput, setLngInput] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationTouched, setLocationTouched] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [photoSize, setPhotoSize] = useState<number | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  const [hasRemovedPhoto, setHasRemovedPhoto] = useState(false);
  const [photoTouched, setPhotoTouched] = useState(false);
  // Mapa usado para marcar visualmente quais atividades possuem feedback pendente de leitura pelo fiscal.
  // Feedback exibido dentro do modal de detalhes da atividade.
  const [selectedActivityFeedback, setSelectedActivityFeedback] = useState<FeedbackEntry | null>(null);
  
  const feedbackSeenStorageKey = useMemo(() => {
    if (!sessionUser?.email) return null;
    return `feedbackSeen::${sessionUser.email.toLowerCase()}`;
  }, [sessionUser?.email]);
  // Exporta o registro completo de atividades para um arquivo XLSX,
  // incluindo o feedback mais recente vinculado a cada uma (quando existir).
  // Gera o arquivo XLSX com o resumo das atividades. Essa função é memorizada com useCallback
  // porque a interface passa como handler para um botão; assim evitamos recriar a função
  // em todo render sem necessidade.
  const exportarDashboardXlsx = useCallback(async () => {
    if (!isSupervisor || !activities.length) return;

    // Token da sessão: necessário para autenticar as requisições dos feedbacks.
    const token = getSessionToken();
    // Cache local com o feedback mais recente por atividade (evita duplicar requisições).
    const feedbackMap: Record<string, FeedbackEntry | null> = {};

    if (token) {
      try {
        const feedbackResponses = await Promise.all(
          activities.map(async (atividade) => {
            try {
              const { data } = await axios.get<{ feedback: FeedbackEntry | null }>(
                buildApiUrl(`/api/feedbacks/activity/${atividade.id}`, apiBaseUrl),
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                },
              );
              return [atividade.id, data?.feedback ?? null] as const;
            } catch (error) {
              console.warn(`Falha ao carregar feedback da atividade ${atividade.id} durante exportação.`, error);
              return [atividade.id, null] as const;
            }
          }),
        );

        // Converte o array de respostas em um mapa indexado por ID da atividade.
        feedbackResponses.forEach(([id, feedback]) => {
          feedbackMap[id] = feedback;
        });
      } catch (error) {
        console.warn("Erro ao preparar feedbacks para exportação.", error);
      }
    } else {
      console.warn("Token ausente ao exportar atividades: feedbacks não serão incluídos.");
    }

    const worksheetData: (string | number)[][] = [
      ["Registro de atividades"],
      ["Gerado em", new Date().toLocaleString("pt-BR")],
      ["Total de registros", activities.length],
      [],
      [
        "Data",
        "Hora",
        "Descrição",
        "Nível",
        "Responsável",
        "Email",
        "Local",
        "Sub-locais",
        "Status",
        "Feedback Conteúdo",
        "Feedback Autor",
        "Feedback Registro",
      ],
    ];

    activities.forEach((atividade) => {
      const feedbackEntry = feedbackMap[atividade.id] ?? null;
      const feedbackContent = feedbackEntry
        ? (feedbackEntry.contentText || feedbackEntry.subject || "").trim() || "--"
        : "--";
      const feedbackAuthor = feedbackEntry
        ? (feedbackEntry.authorName || feedbackEntry.authorEmail || "Supervisor")
        : "--";
      const feedbackTimestamp = feedbackEntry?.createdAt ? formatDateTime(feedbackEntry.createdAt) : "--";

      // Cada linha representa uma atividade registrada, com dados essenciais e resumo do feedback.
      worksheetData.push([
        atividade.createdAt ? formatDateOnly(atividade.createdAt) : "--",
        atividade.createdAt ? formatTimeOnly(atividade.createdAt) : "--",
        atividade.descricaoOriginal ?? atividade.registro ?? "--",
        atividade.nivel ?? "--",
        atividade.nome ?? "--",
        atividade.createdBy ?? "--",
        atividade.localPrincipal ?? "--",
        Array.isArray(atividade.subLocais) ? atividade.subLocais.join(", ") : "--",
        atividade.status ?? "--",
        feedbackContent,
        feedbackAuthor,
        feedbackTimestamp,
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    const headerRowIndex = 4;
    const headerColumns = worksheetData[headerRowIndex]?.length ?? 0;
    for (let col = 0; col < headerColumns; col += 1) {
      const cellAddress = XLSX.utils.encode_cell({ r: headerRowIndex, c: col });
      const cell = worksheet[cellAddress];
      if (cell) {
        const font = { ...(cell.s?.font ?? {}), bold: true };
        cell.s = { ...(cell.s ?? {}), font };
      }
    }

    const nivelColumnIndex = 3;
    activities.forEach((atividade, index) => {
      const nivel = atividade.nivel;
      if (!nivel || !(nivel in NIVEL_EXCEL_COLORS)) {
        return;
      }
      const rowIndex = headerRowIndex + 1 + index;
      const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: nivelColumnIndex });
      const cell = worksheet[cellAddress];
      if (!cell) {
        return;
      }
      const fillColor = NIVEL_EXCEL_COLORS[nivel];
      const fill = { patternType: "solid", fgColor: { rgb: fillColor }, bgColor: { rgb: fillColor } };
      cell.s = { ...(cell.s ?? {}), fill };
    });

    // Ajusta larguras para facilitar a leitura do XLSX exportado.
    const colCount = 12;
    const colWidths = Array.from({ length: colCount }, (_, colIndex) => {
      const maxLen = worksheetData.reduce((max, row) => {
        const value = row[colIndex];
        if (value == null) return max;
        return Math.max(max, String(value).length);
      }, 12);
      return { wch: Math.min(Math.max(maxLen + 2, 14), 60) };
    });
    worksheet["!cols"] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Registro de Atividades");
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array", cellStyles: true });
    const blob = new Blob([buffer], { type: "application/octet-stream" });
    const nome = `registro-atividades-${new Date().toISOString().slice(0, 10)}.xlsx`;
    saveAs(blob, nome);
  }, [activities, apiBaseUrl, isSupervisor]);


  // Lê do localStorage os feedbacks já visualizados pelo fiscal. Mantemos dentro de useCallback
  // para reutilizar a mesma função nas dependências de outros hooks e evitar reler o storage
  // quando nada mudou.
  const readSeenFeedbacks = useCallback(() => {
    if (!feedbackSeenStorageKey) return new Set<string>();
    try {
      const raw = window.localStorage.getItem(feedbackSeenStorageKey);
      if (!raw) return new Set<string>();
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return new Set<string>(parsed.filter((value): value is string => typeof value === "string" && value.length > 0));
      }
    } catch (error) {
      console.warn("Não foi possível ler feedbacks vistos do storage:", error);
    }
    return new Set<string>();
  }, [feedbackSeenStorageKey]);

  // Persiste a lista de feedbacks vistos. Se a escrita falhar (ex.: storage cheio),
  // apenas registramos um aviso em vez de quebrar o fluxo do usuário.
  const persistSeenFeedbacks = useCallback(
    (seen: Set<string>) => {
      if (!feedbackSeenStorageKey) return;
      try {
        window.localStorage.setItem(feedbackSeenStorageKey, JSON.stringify(Array.from(seen)));
      } catch (error) {
        console.warn("Não foi possível salvar feedbacks vistos no storage:", error);
      }
    },
    [feedbackSeenStorageKey],
  );

  // Marca um feedback como lido para não destacar novamente a mesma atividade.
  // Usamos Set para operações rápidas e simples (has/add).
  const markFeedbackAsSeen = useCallback(
    (activityId: string) => {
      if (!feedbackSeenStorageKey) return;
      const current = readSeenFeedbacks();
      if (current.has(activityId)) return;
      current.add(activityId);
      persistSeenFeedbacks(current);
    },
    [feedbackSeenStorageKey, persistSeenFeedbacks, readSeenFeedbacks],
  );

  // Estados para local e sublocais
  const [localSelecionado, setLocalSelecionado] = useState<string>("");
  const [subLocaisSelecionados, setSubLocaisSelecionados] = useState<Record<string, string>>({});
  const [pavimentoSelecionado, setPavimentoSelecionado] = useState<string>("");
  
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Atividade | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Atividade | null>(null);
  
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
  const [latestFeedback, setLatestFeedback] = useState<FeedbackEntry | null>(null);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const isEditing = Boolean(editingActivityId);
  const isBlocoMSelecionado = localSelecionado === BLOCO_M_ID;
  const temSubLocalSelecionado = Object.keys(subLocaisSelecionados).length > 0;
  
  // A descrição só pode ser editada se local e pelo menos um sublocal estiverem selecionados
  const podeEscreverDescricao = localSelecionado !== "" && temSubLocalSelecionado;
  
  const hasCoordinates = typeof lat === "number" && typeof lng === "number";

  const canSave =
    descricao.trim() !== "" &&
    nivel !== "" &&
    status !== "" &&
    localSelecionado !== "" &&
  temSubLocalSelecionado &&
  !isCompressingPhoto &&
    photoData !== null &&
    hasCoordinates;

  // Atualiza o mapa de destaque das atividades (true = feedback visível na lista).
  // Controla o "badge" das atividades que ainda possuem feedback não lido.
  // O state é um mapa: id da atividade -> true se precisa destacar.
  const updateFeedbackHighlight = useCallback(
    (activityId: string, hasFeedback: boolean) => {
      setFeedbackActivityMap((prev) => {
        if (hasFeedback) {
          if (!isFiscal || !targetedActivityIndex[activityId]) {
            return prev;
          }
          if (prev[activityId]) return prev;
          return { ...prev, [activityId]: true };
        }

        if (!prev[activityId]) {
          return prev;
        }

        const next = { ...prev };
        delete next[activityId];
        return next;
      });

      if (!hasFeedback && isFiscal) {
        markFeedbackAsSeen(activityId);
      }
    },
    [isFiscal, markFeedbackAsSeen, targetedActivityIndex],
  );

  // Fiscal abre o painel de feedback: carregamos o conteúdo mais recente.
  // Fiscal abre o painel de feedback: buscamos o texto mais recente e removemos o destaque.
  const handleOpenFeedbackDialog = useCallback(
    async (activity: Atividade) => {
      const isTargeted = Boolean(targetedActivityIndex[activity.id]);
      if (isFiscal && !isActivityOwnedByUser(activity) && !isTargeted) {
        setIsFeedbackDialogOpen(false);
        setIsLoadingFeedback(false);
        setFeedbackError("Você não tem acesso ao feedback desta atividade.");
        setLatestFeedback(null);
        return;
      }

      setIsFeedbackDialogOpen(true);
      setIsLoadingFeedback(true);
      setFeedbackError(null);
      setLatestFeedback(null);

      const token = getSessionToken();
      if (!token) {
        setIsLoadingFeedback(false);
        setFeedbackError("Sessão expirada. Faça login novamente.");
        return;
      }

      try {
        const { data } = await axios.get<{ feedback: FeedbackEntry | null }>(
          buildApiUrl(`/api/feedbacks/activity/${activity.id}`, apiBaseUrl),
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        const feedback = data?.feedback ?? null;
        setLatestFeedback(feedback);
        // Fiscal visualizou: removemos o destaque local para não manter o aviso.
        if (feedback && isFiscal) {
          updateFeedbackHighlight(activity.id, false);
        }

        if (!feedback) {
          setFeedbackError("Nenhum feedback disponível no momento.");
        }
      } catch (error) {
        console.error("Erro ao carregar feedback da atividade:", error);
        setFeedbackError("Não foi possível carregar o feedback. Tente novamente.");
      } finally {
        setIsLoadingFeedback(false);
      }
    },
    [apiBaseUrl, isFiscal, isActivityOwnedByUser, targetedActivityIndex, updateFeedbackHighlight],
  );

  const renderActionMenu = (atividade: Atividade, triggerClassName?: string) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8", triggerClassName)}
          aria-label="Mais opções"
          onClick={(event) => event.stopPropagation()}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
        {(isSupervisor || (isFiscal && (isActivityOwnedByUser(atividade) || targetedActivityIndex[atividade.id]))) && (
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              if (isFiscal) {
                void handleOpenFeedbackDialog(atividade);
              } else if (isSupervisor) {
                window.dispatchEvent(
                  new CustomEvent("open-feedback-sheet", {
                    detail: {
                      activity: {
                        id: atividade.id,
                        createdBy: atividade.createdBy ?? null,
                        nome: atividade.nome ?? null,
                      },
                    },
                  }),
                );
              }
            }}
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            {isFiscal ? "Ver feedback" : "Feedback"}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            startEditActivity(atividade);
          }}
        >
          <Pencil className="mr-2 h-4 w-4" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          disabled={isDeleting}
          onSelect={(event) => {
            event.preventDefault();
            handleDeleteActivity(atividade);
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {isDeleting ? "Removendo..." : "Remover"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // Ao montar, fiscais carregam a lista de atividades com feedback destinado a eles.
  useEffect(() => {
    if (!sessionUser?.email) {
      setFeedbackActivityMap({});
      setTargetedActivityIndex({});
      return;
    }

    if (!isFiscal) {
      setFeedbackActivityMap({});
      setTargetedActivityIndex({});
      return;
    }

    const token = getSessionToken();
    if (!token) {
      setFeedbackActivityMap({});
      setTargetedActivityIndex({});
      return;
    }

    let cancelled = false;

    const fetchFeedbackHighlights = async () => {
      try {
        const { data } = await axios.get<{ activities?: string[] }>(
          buildApiUrl("/api/feedbacks/mine", apiBaseUrl),
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (cancelled) return;

        const seen = readSeenFeedbacks();
        const nextMap: Record<string, boolean> = {};
        const nextTargetIndex: Record<string, true> = {};
        if (Array.isArray(data.activities)) {
          data.activities.forEach((activityId) => {
            if (typeof activityId === "string" && activityId.trim().length > 0) {
              const trimmedId = activityId.trim();
              nextTargetIndex[trimmedId] = true;
              if (!seen.has(trimmedId)) {
                nextMap[trimmedId] = true;
              }
            }
          });
        }
        setFeedbackActivityMap(nextMap);
        setTargetedActivityIndex(nextTargetIndex);
      } catch (error) {
        if (!cancelled) {
          console.error("Erro ao carregar feedbacks atribuídos:", error);
        }
      }
    };

    fetchFeedbackHighlights();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, isFiscal, readSeenFeedbacks, sessionUser?.email]);

  // Carrega o feedback da atividade quando abrimos o modal de detalhes.
  // Quando abrimos o modal de detalhes, carregamos o feedback mais recente
  // para exibir em tempo real dentro do diálogo.
  const loadActivityFeedback = useCallback(
    async (activity: Atividade) => {
      const token = getSessionToken();
      if (!token) {
        setSelectedActivityFeedback(null);
        return;
      }

      try {
        const { data } = await axios.get<{ feedback: FeedbackEntry | null }>(
          buildApiUrl(`/api/feedbacks/activity/${activity.id}`, apiBaseUrl),
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        const feedback = data?.feedback ?? null;
        setSelectedActivityFeedback(feedback);
        if (feedback && isFiscal) {
          updateFeedbackHighlight(activity.id, false);
        } else {
          updateFeedbackHighlight(activity.id, Boolean(feedback));
        }
      } catch (error) {
        console.error("Erro ao carregar feedback da atividade:", error);
        setSelectedActivityFeedback(null);
      }
    },
    [apiBaseUrl, isFiscal, updateFeedbackHighlight],
  );

  // Função utilitária para limpar completamente o formulário da atividade
  // Limpa todos os campos do formulário, incluindo estados auxiliares como preview de foto.
  const resetForm = useCallback(() => {
    setDescricao("");
    setNivel("");
    setStatus("");
    setLat("");
    setLng("");
    setLatInput("");
    setLngInput("");
    setPhotoPreview((prev) => {
      revokePreview(prev);
      return null;
    });
    setPhotoData(null);
    setPhotoSize(null);
    setPhotoError(null);
    setIsCompressingPhoto(false);
    setHasRemovedPhoto(false);
    setLocationError(null);
    setLocationTouched(false);
    setPhotoTouched(false);
    setLocalSelecionado("");
    setSubLocaisSelecionados({});
    setPavimentoSelecionado("");
    setSelectedActivityFeedback(null);
  }, []);

  // Preenche o formulário com os dados existentes quando estamos editando
  // Preenche o formulário com uma atividade existente para edição.
  // Esse método cuida de normalizar sublocais e converter coordenadas para string.
  const fillFormWithActivity = useCallback((activity: Atividade) => {
    setDescricao(activity.descricaoOriginal ?? activity.registro ?? "");
    setNivel(activity.nivel);
    setStatus(activity.status);
    const activityLat = typeof activity.lat === "number" ? Number(activity.lat.toFixed(6)) : "";
    const activityLng = typeof activity.lng === "number" ? Number(activity.lng.toFixed(6)) : "";
    setLat(activityLat);
    setLng(activityLng);
    setLatInput(typeof activityLat === "number" ? activityLat.toString() : "");
    setLngInput(typeof activityLng === "number" ? activityLng.toString() : "");
    setPhotoPreview((prev) => {
      revokePreview(prev);
      return activity.fotoUrl ?? null;
    });
    setPhotoData(activity.fotoUrl ?? null);
    setPhotoSize(activity.fotoUrl && activity.fotoUrl.startsWith("data:") ? estimateDataUrlSize(activity.fotoUrl) : null);
    setPhotoError(null);
    setHasRemovedPhoto(false);
    setLocationError(null);
    setLocationTouched(false);
    setPhotoTouched(false);
    const localMatch = locaisDisponiveis.find((local) => {
      if (!activity.localPrincipal) return false;
      return local.nome.toLowerCase() === activity.localPrincipal.toLowerCase() || local.id === activity.localPrincipal;
    });
    setLocalSelecionado(localMatch ? localMatch.id : "");

    const nomesSelecionados = (activity.subLocais ?? []).filter((item): item is string => Boolean(item?.trim()));
    const selecionados: Record<string, string> = {};

    if (localMatch?.id === BLOCO_M_ID) {
      let pavimentoDetectado: string | null = null;

      nomesSelecionados.forEach((nomeOriginal) => {
        const nome = nomeOriginal.trim();
        const partes = nome.split(" - ").map((parte) => parte.trim());

        if (partes.length >= 3 && partes[0].toLowerCase() === "bloco m") {
          const pavimentoNome = partes[1];
          const areaNome = partes.slice(2).join(" - ");
          const pavimentoEncontrado = pavimentosBlocoM.find((item) => item.nome.toLowerCase() === pavimentoNome.toLowerCase());
          const areaEncontrada = areasBlocoM.find((item) => item.nome.toLowerCase() === areaNome.toLowerCase());

          if (pavimentoEncontrado && areaEncontrada) {
            const chave = getBlocoMSubLocalKey(pavimentoEncontrado.id, areaEncontrada.id);
            selecionados[chave] = getBlocoMSubLocalLabel(pavimentoEncontrado.nome, areaEncontrada.nome);
            if (!pavimentoDetectado) {
              pavimentoDetectado = pavimentoEncontrado.id;
            }
            return;
          }
        }

        const chaveFallback = `custom__${nome}`;
        selecionados[chaveFallback] = nome;
      });

      setPavimentoSelecionado(pavimentoDetectado ?? "");
    } else {
      nomesSelecionados.forEach((nomeOriginal) => {
        const nome = nomeOriginal.trim();
        const subLocalCorrespondente = subLocaisDisponiveis.find((item) => item.nome.toLowerCase() === nome.toLowerCase());

        if (subLocalCorrespondente) {
          selecionados[subLocalCorrespondente.id] = subLocalCorrespondente.nome;
        } else {
          const chaveFallback = `custom__${nome}`;
          selecionados[chaveFallback] = nome;
        }
      });

      setPavimentoSelecionado("");
    }

    setSubLocaisSelecionados(selecionados);
  }, []);

  const openAddDialog = useCallback(() => {
    setEditingActivityId(null);
    resetForm();
    setIsDialogOpen(true);
  }, [resetForm]);

  // Abre o diálogo automaticamente quando acessado via deep link (/atividades/nova)
  useEffect(() => {
    if (autoOpenNew) {
      openAddDialog();
    }
  }, [autoOpenNew, openAddDialog]);

  function handleLocalChange(value: string) {
    setLocalSelecionado(value);
    setSubLocaisSelecionados({});
    setPavimentoSelecionado("");
  }

  function handleDefaultSubLocalSelect(value: string) {
    setSubLocaisSelecionados((prev) => {
      if (value === "") {
        return {};
      }

      const subLocal = subLocaisDisponiveis.find((item) => item.id === value);
      if (subLocal) {
        return { [subLocal.id]: subLocal.nome };
      }

      const customLabel = prev[value];
      if (customLabel) {
        return { [value]: customLabel };
      }

      return {};
    });
  }

  function handleBlocoMAreaSelect(
    pavimentoId: string,
    pavimentoNome: string,
    areaId: string
  ) {
    setSubLocaisSelecionados((prev) => {
      const next = { ...prev };

      Object.keys(next).forEach((key) => {
        if (key.startsWith(`${BLOCO_M_ID}__${pavimentoId}__`)) {
          delete next[key];
        }
      });

      if (areaId) {
        const area = areasBlocoM.find((item) => item.id === areaId);
        if (area) {
          const key = getBlocoMSubLocalKey(pavimentoId, areaId);
          next[key] = getBlocoMSubLocalLabel(pavimentoNome, area.nome);
        }
      }

      return next;
    });
  }

  function removeCustomSubLocal(key: string) {
    setSubLocaisSelecionados((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  // Inicia o fluxo de edição: prepara o formulário com os dados atuais e abre o diálogo.
  const startEditActivity = useCallback((activity: Atividade) => {
    resetForm();
    setEditingActivityId(activity.id);
    fillFormWithActivity(activity);
    setIsDialogOpen(true);
    setIsDetailOpen(false);
    setSelectedActivity(activity);
  }, [fillFormWithActivity, resetForm]);

  // Abre o modal de confirmação de exclusão. Mantemos o item pendente no estado
  // para finalizar a ação depois que o usuário confirmar.
  const handleDeleteActivity = useCallback((activity: Atividade) => {
    setPendingDelete(activity);
    setIsConfirmDeleteOpen(true);
  }, []);

  const cancelDelete = useCallback(() => {
    if (isDeleting) return;
    setIsConfirmDeleteOpen(false);
    setPendingDelete(null);
  }, [isDeleting]);

  // Remove a atividade escolhida e atualiza a UI. Usamos try/catch para manter
  // a interface responsiva mesmo se a requisição falhar.
  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;

    setIsDeleting(true);
    try {
      await deleteActivity(scope, pendingDelete.id);

      if (selectedActivity?.id === pendingDelete.id) {
        setSelectedActivity(null);
        setIsDetailOpen(false);
        setSelectedActivityFeedback(null);
      }

      if (editingActivityId === pendingDelete.id) {
        setEditingActivityId(null);
        resetForm();
      }

      updateFeedbackHighlight(pendingDelete.id, false);
    } catch (error) {
      console.error("Erro ao remover atividade:", error);
    } finally {
      setIsDeleting(false);
      setIsConfirmDeleteOpen(false);
      setPendingDelete(null);
    }
  }, [deleteActivity, editingActivityId, pendingDelete, resetForm, scope, selectedActivity, updateFeedbackHighlight]);

  function handleCancel() {
    setIsDialogOpen(false);
    resetForm();
    setEditingActivityId(null);
  }

  function openActivityDetail(activity: Atividade) {
    setSelectedActivity(activity);
    setSelectedActivityFeedback(null);
    setIsDetailOpen(true);
    const isTargeted = Boolean(targetedActivityIndex[activity.id]);
    if (isSupervisor || isActivityOwnedByUser(activity) || isTargeted) {
      void loadActivityFeedback(activity);
    } else {
      setSelectedActivityFeedback(null);
    }
  }

  function closeActivityDetail() {
    setIsDetailOpen(false);
    setSelectedActivity(null);
    setSelectedActivityFeedback(null);
  }

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setPhotoError(null);
    setPhotoTouched(false);
    setIsCompressingPhoto(true);

    try {
      const { dataUrl, size } = await compressImageFile(file);

      setPhotoPreview((prev) => {
        revokePreview(prev);
        return dataUrl;
      });
      setPhotoData(dataUrl);
      setPhotoSize(size);
      setHasRemovedPhoto(false);
      setPhotoTouched(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível processar a imagem selecionada.";
      setPhotoError(message);
      setPhotoPreview((prev) => {
        revokePreview(prev);
        return null;
      });
      setPhotoData(null);
      setPhotoSize(null);
      setPhotoTouched(true);
    } finally {
      setIsCompressingPhoto(false);
      if (event.target) {
        event.target.value = "";
      }
    }
  }

  function handleRemovePhoto() {
    setPhotoPreview((prev) => {
      revokePreview(prev);
      return null;
    });
    setPhotoData(null);
    setPhotoSize(null);
    setHasRemovedPhoto(true);
    setPhotoError(null);
    setPhotoTouched(true);

    const input = document.getElementById("foto-input") as HTMLInputElement | null;
    if (input) {
      input.value = "";
    }
  }

  async function handleUseCurrentLocation() {
    if (!("geolocation" in navigator)) {
      setLocationError("Este dispositivo não suporta geolocalização.");
      setLocationTouched(true);
      return;
    }
    try {
      setIsLocating(true);
      setLocationTouched(true);
      setLocationError(null);
      await new Promise<void>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const latitude = Number(pos.coords.latitude.toFixed(6));
            const longitude = Number(pos.coords.longitude.toFixed(6));
            setLat(latitude);
            setLng(longitude);
            setLatInput(latitude.toString());
            setLngInput(longitude.toString());
            resolve();
          },
          (err) => reject(err),
          { enableHighAccuracy: true, timeout: 8000 }
        );
      });
    } catch {
      setLocationError("Não foi possível obter a localização atual. Tente novamente.");
      setLat("");
      setLng("");
      setLatInput("");
      setLngInput("");
    } finally {
      setIsLocating(false);
    }
  }

/* function handleManualLatitudeChange(value: string) {
  // Entrada manual de latitude desabilitada temporariamente.
}

function handleManualLongitudeChange(value: string) {
  // Entrada manual de longitude desabilitada temporariamente.
} */

  function handleClearLocation() {
    setLat("");
    setLng("");
    setLatInput("");
    setLngInput("");
    setLocationTouched(true);
    setLocationError("Informe latitude e longitude.");
  }

  async function handleSubmit() {
    const hasPhoto = photoData !== null;
    const hasLocation = typeof lat === "number" && typeof lng === "number";

    if (!hasPhoto) {
      setPhotoTouched(true);
      if (!photoError) {
        setPhotoError("Adicione uma foto para salvar a atividade.");
      }
    }

    if (!hasLocation) {
      setLocationTouched(true);
      setLocationError("Informe latitude e longitude.");
    }

    if (!canSave) {
      return;
    }

    const localPrincipal = locaisDisponiveis.find((local) => local.id === localSelecionado);
    const subLocaisAtivos = Object.values(subLocaisSelecionados);
    const descricaoTrim = descricao.trim();

    const userDisplayName =
      sessionUser?.name?.trim() || sessionUser?.email?.trim() || sessionUser?.uid?.trim();
    const activityBeingEdited = editingActivityId
      ? activities.find((item) => item.id === editingActivityId)
      : null;
    const localPrincipalNome = localPrincipal?.nome ?? activityBeingEdited?.localPrincipal ?? null;
    let fotoUrlPayload: string | null | undefined;
    if (photoData !== null) {
      fotoUrlPayload = photoData;
    } else if (hasRemovedPhoto) {
      fotoUrlPayload = null;
    } else if (editingActivityId) {
      fotoUrlPayload = activityBeingEdited?.fotoUrl ?? null;
    } else {
      fotoUrlPayload = undefined;
    }

    const payload = {
      nome: userDisplayName,
      descricao: descricaoTrim,
      descricaoOriginal: descricaoTrim,
      nivel: nivel as NivelAtividade,
      status: status as StatusAtividade,
      localPrincipal: localPrincipalNome,
      subLocais: subLocaisAtivos,
      latitude: typeof lat === "number" ? lat : undefined,
      longitude: typeof lng === "number" ? lng : undefined,
      fotoUrl: fotoUrlPayload,
    };

    setIsSubmitting(true);
    try {
      const atividadeAtualizada = editingActivityId
        ? await updateActivity(scope, editingActivityId, payload)
        : await createActivity(scope, payload);

      setSelectedActivity((prev) => (prev && prev.id === atividadeAtualizada.id ? atividadeAtualizada : prev));
      resetForm();
      setIsDialogOpen(false);
      setEditingActivityId(null);
    } catch (error) {
      console.error(editingActivityId ? "Erro ao atualizar atividade:" : "Erro ao criar atividade:", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{effectiveTitle}</h1>
        {isSupervisor && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={exportarDashboardXlsx}
                variant="outline"
                size="icon"
                className="ml-auto"
                aria-label="Exportar registro de atividades em XLSX"
              >
                <Download className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Exportar XLSX</TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link to="/relatorios" className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground">
              <span>Média de registro semanal:</span>
              <span className="font-medium text-foreground">{mediaSemanal}</span>
            </Link>
          </TooltipTrigger>
          <TooltipContent>
            Ir para Relatórios
          </TooltipContent>
        </Tooltip>
      </div>

      {isLoadingActivities && groupedEntries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-muted-foreground">
          Carregando atividades...
        </div>
      ) : groupedEntries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-muted-foreground">
          Nenhuma atividade cadastrada ainda.
        </div>
      ) : (
        groupedEntries.map(([dia, atividades]) => (
          <div key={dia} className="space-y-4">
            {/* Separador com o dia */}
            <div className="flex items-center">
              <div className="flex-1 h-px bg-gray-300"></div>
              <div className="px-4 py-2 bg-gray-200 rounded-full text-sm font-medium text-gray-700">
                {dia} - {atividades.length} atividades
              </div>
              <div className="flex-1 h-px bg-gray-300"></div>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-3 md:hidden">
                {atividades.map((atividade) => {
                  const descricaoVisivel = atividade.descricaoOriginal ?? atividade.registro;
                  const hasSupervisorFeedback = Boolean(feedbackActivityMap[atividade.id]);
                  const indicator = hasSupervisorFeedback ? (
                    <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
                  ) : null;

                  return (
                    <div
                      key={atividade.id}
                      className={cn(
                        "group relative flex cursor-pointer flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-colors focus:outline-none hover:border-gray-300 hover:bg-gray-50 active:bg-gray-100",
                        hasSupervisorFeedback && "ring-2 ring-amber-400 ring-offset-2 ring-offset-white",
                      )}
                      onClick={() => openActivityDetail(atividade)}
                      tabIndex={0}
                      role="button"
                      aria-label={`Ver detalhes da atividade de ${atividade.nome}`}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openActivityDetail(atividade);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-col gap-2">
                          {!effectiveFilterByCurrentUser && (
                            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                              {indicator}
                              <span className="truncate">{atividade.nome}</span>
                              {hasSupervisorFeedback && (
                                <span className="sr-only">Esta atividade possui feedback do supervisor.</span>
                              )}
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            {effectiveFilterByCurrentUser ? indicator : null}
                            {effectiveFilterByCurrentUser && hasSupervisorFeedback && (
                              <span className="sr-only">Esta atividade possui feedback do supervisor.</span>
                            )}
                            <MapPin className="h-4 w-4 text-gray-400" aria-hidden="true" />
                            <span className="truncate">{atividade.localPrincipal ?? "--"}</span>
                          </div>
                        </div>
                        {renderActionMenu(atividade, "-mr-1")}
                      </div>

                      <div className="text-sm text-gray-700">
                        <span className="block break-words">{descricaoVisivel}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-gray-600">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-1",
                            atividade.nivel === "Máximo"
                              ? "bg-red-100 text-red-800"
                              : atividade.nivel === "Alto"
                                ? "bg-orange-100 text-orange-800"
                                : atividade.nivel === "Normal"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-green-100 text-green-800",
                          )}
                        >
                          {atividade.nivel}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-200 px-2 py-1 text-gray-700">
                          {getStatusIcon(atividade.status)}
                          <span>{atividade.status}</span>
                        </span>
                        {atividade.createdAt ? (
                          <span className="text-gray-500">{formatDateTime(atividade.createdAt)}</span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden md:block">
                <table className="w-full table-fixed border-separate border-spacing-y-4">
                  <thead>
                    <tr className="text-sm font-medium text-gray-600">
                      {!effectiveFilterByCurrentUser && <th className="pb-3 px-4 w-2/12 text-left">Nome</th>}
                      <th className={`pb-3 px-4 ${effectiveFilterByCurrentUser ? "w-3/12" : "w-2/12"} text-left`}>Local</th>
                      <th className={`pb-3 px-4 ${effectiveFilterByCurrentUser ? "w-5/12" : "w-4/12"} text-left`}>Descrição</th>
                      <th className="pb-3 px-4 w-1/12 text-center">Nível</th>
                      <th className="pb-3 px-4 w-1/12 text-center">Status</th>
                      <th className="pb-3 px-4 w-2/12 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {atividades.map((atividade) => {
                      const descricaoVisivel = atividade.descricaoOriginal ?? atividade.registro;
                      const hasSupervisorFeedback = Boolean(feedbackActivityMap[atividade.id]);
                      const indicator =
                        hasSupervisorFeedback ? (
                          <span
                            className="inline-flex h-2 w-2 shrink-0 rounded-full bg-amber-500"
                            aria-hidden="true"
                          />
                        ) : null;

                      return (
                        <tr
                          key={atividade.id}
                          className={cn(
                            "group align-middle cursor-pointer focus:outline-none",
                            hasSupervisorFeedback && "relative ring-2 ring-amber-400 ring-offset-2 ring-offset-white rounded-lg",
                          )}
                          onClick={() => openActivityDetail(atividade)}
                          tabIndex={0}
                          role="button"
                          aria-label={`Ver detalhes da atividade de ${atividade.nome}`}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openActivityDetail(atividade);
                            }
                          }}
                        >
                          {!effectiveFilterByCurrentUser && (
                            <td className="bg-gray-50 px-4 py-4 text-left text-sm font-medium text-gray-800 rounded-l-lg transition-colors group-hover:bg-gray-100">
                              <div className="flex items-center gap-2">
                                {indicator}
                                <span>{atividade.nome}</span>
                                {hasSupervisorFeedback && (
                                  <span className="sr-only">Esta atividade possui feedback do supervisor.</span>
                                )}
                              </div>
                            </td>
                          )}

                          <td
                            className={cn(
                              "bg-gray-50 px-4 py-4 text-left text-sm text-gray-600 transition-colors group-hover:bg-gray-100",
                              effectiveFilterByCurrentUser && "rounded-l-lg",
                            )}
                          >
                            <div className="flex items-center gap-2">
                              {effectiveFilterByCurrentUser ? indicator : null}
                              <span>{atividade.localPrincipal ?? "--"}</span>
                              {effectiveFilterByCurrentUser && hasSupervisorFeedback && (
                                <span className="sr-only">Esta atividade possui feedback do supervisor.</span>
                              )}
                            </div>
                          </td>

                          <td className="bg-gray-50 px-4 py-4 text-left text-sm text-gray-600 transition-colors group-hover:bg-gray-100">
                            <span className="break-words">{descricaoVisivel}</span>
                          </td>

                          <td className="bg-gray-50 px-4 py-4 text-center transition-colors group-hover:bg-gray-100">
                            {isMobile ? (
                              <div
                                className={`mx-auto h-6 w-6 rounded-full ${getNivelColor(atividade.nivel)}`}
                                aria-label={`Nível: ${atividade.nivel}`}
                                role="img"
                              />
                            ) : (
                              <span
                                className={`px-2 py-1 rounded-full text-xs whitespace-nowrap ${
                                  atividade.nivel === "Máximo"
                                    ? "bg-red-100 text-red-800"
                                    : atividade.nivel === "Alto"
                                    ? "bg-orange-100 text-orange-800"
                                    : atividade.nivel === "Normal"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-green-100 text-green-800"
                                }`}
                              >
                                {atividade.nivel}
                              </span>
                            )}
                          </td>

                          <td className="bg-gray-50 px-4 py-4 text-center transition-colors group-hover:bg-gray-100">
                            {isMobile ? (
                              getStatusIcon(atividade.status)
                            ) : (
                              <span
                                className={`px-2 py-1 rounded-full text-xs whitespace-nowrap ${
                                  atividade.status === "Concluído"
                                    ? "bg-green-100 text-green-800"
                                    : atividade.status === "Pendente"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {atividade.status}
                              </span>
                            )}
                          </td>

                          <td className="bg-gray-50 px-4 py-4 transition-colors group-hover:bg-gray-100 rounded-r-lg">
                            <div className="flex justify-end">{renderActionMenu(atividade)}</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))
      )}
      <Button
        onClick={openAddDialog}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg"
        size="icon"
        aria-label="Adicionar atividade"
      >
        <Plus className="h-6 w-6" />
      </Button>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            resetForm();
            setEditingActivityId(null);
            // Se veio de /atividades/nova, ao fechar o diálogo navega para /atividades
            if (location.pathname === "/atividades/nova") {
              navigate("/atividades", { replace: true });
            }
          }
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] sm:w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Editar atividade" : "Adicionar atividade"}</DialogTitle>
            <DialogDescription className="sr-only">
              Formulário para registrar as informações e a foto de uma atividade.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 mt-4 mb-4">
            {/* Seleção de Local */}
            <div className="grid gap-2">
              <Label htmlFor="local">Local</Label>
              <select
                id="local"
                value={localSelecionado}
                onChange={(e) => handleLocalChange(e.target.value)}
                className="border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-sm"
              >
                <option value="">Selecione um local...</option>
                {locaisDisponiveis.map((local) => (
                  <option key={local.id} value={local.id}>
                    {local.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Seleção de Sub-locais */}
            {localSelecionado && (
              <div className="grid gap-2">
                <Label>Sub-locais (selecione pelo menos um)</Label>

                {isBlocoMSelecionado ? (
                  <div className="grid gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="pavimento">Pavimento</Label>
                      <select
                        id="pavimento"
                        value={pavimentoSelecionado}
                        onChange={(event) => {
                          const novoPavimento = event.target.value;
                          setPavimentoSelecionado(novoPavimento);
                          if (!novoPavimento) {
                            setSubLocaisSelecionados((prev) => {
                              const next = { ...prev };
                              Object.keys(next).forEach((chave) => {
                                if (chave.startsWith(`${BLOCO_M_ID}__`)) {
                                  delete next[chave];
                                }
                              });
                              return next;
                            });
                          }
                        }}
                        className="border-input h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm"
                      >
                        <option value="">Selecione um pavimento...</option>
                        {pavimentosBlocoM.map((pavimento) => (
                          <option key={pavimento.id} value={pavimento.id}>
                            {pavimento.nome}
                          </option>
                        ))}
                      </select>
                    </div>

                    {pavimentoSelecionado ? (
                      (() => {
                        const pavimentoAtual = pavimentosBlocoM.find((item) => item.id === pavimentoSelecionado);
                        if (!pavimentoAtual) return null;

                        const chaveSelecionada = Object.keys(subLocaisSelecionados).find((key) =>
                          key.startsWith(`${BLOCO_M_ID}__${pavimentoAtual.id}__`)
                        );
                        const areaSelecionadaId = chaveSelecionada ? chaveSelecionada.split("__")[2] ?? "" : "";

                        return (
                          <div className="grid gap-3">
                            <div className="grid gap-2">
                              <Label htmlFor="area-bloco-m">Área</Label>
                              <select
                                id="area-bloco-m"
                                value={areaSelecionadaId}
                                onChange={(event) => {
                                  handleBlocoMAreaSelect(
                                    pavimentoAtual.id,
                                    pavimentoAtual.nome,
                                    event.target.value
                                  );
                                }}
                                className="border-input h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm"
                              >
                                <option value="">Selecione uma área...</option>
                                {areasBlocoM.map((area) => (
                                  <option key={area.id} value={area.id}>
                                    {area.nome}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {Object.entries(subLocaisSelecionados)
                              .filter(([key]) => key.startsWith("custom__"))
                              .map(([key, label]) => (
                                <div key={key} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                                  <span>{label}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeCustomSubLocal(key)}
                                    className="h-7 px-2"
                                  >
                                    Remover
                                  </Button>
                                </div>
                              ))}
                          </div>
                        );
                      })()
                    ) : (
                      <p className="text-xs text-muted-foreground">Selecione um pavimento para visualizar as áreas disponíveis.</p>
                    )}
                  </div>
                ) : (
                  <div className="grid gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="sub-local-default">Sub-local</Label>
                      <select
                        id="sub-local-default"
                        value={(() => {
                          const chavePadrao = Object.keys(subLocaisSelecionados).find(
                            (key) => !key.startsWith(`${BLOCO_M_ID}__`) && !key.startsWith("custom__")
                          );
                          return chavePadrao ?? "";
                        })()}
                        onChange={(event) => handleDefaultSubLocalSelect(event.target.value)}
                        className="border-input h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm"
                      >
                        <option value="">Selecione um sub-local...</option>
                        {subLocaisDisponiveis.map((subLocal) => (
                          <option key={subLocal.id} value={subLocal.id}>
                            {subLocal.nome}
                          </option>
                        ))}
                      </select>
                    </div>

                    {Object.entries(subLocaisSelecionados)
                      .filter(([key]) => key.startsWith("custom__"))
                      .map(([key, label]) => (
                        <div key={key} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                          <span>{label}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCustomSubLocal(key)}
                            className="h-7 px-2"
                          >
                            Remover
                          </Button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* Descrição - só habilitada após selecionar local */}
            <div className="grid gap-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Input
                id="descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder={podeEscreverDescricao ? "Descreva a atividade" : "Selecione um local e pelo menos um sub-local"}
                disabled={!podeEscreverDescricao}
                className={!podeEscreverDescricao ? "opacity-50 cursor-not-allowed" : ""}
              />
              {!podeEscreverDescricao && (
                <p className="text-xs text-muted-foreground">
                  Selecione um local e pelo menos um sub-local para habilitar a descrição.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="nivel">Nível</Label>
                <select
                  id="nivel"
                  value={nivel}
                  onChange={(e) => {
                    const v = e.target.value;
                    setNivel(isNivelAtividade(v) ? v : "");
                  }}
                  className="border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-sm"
                >
                  <option value="">Selecione...</option>
                  <option value="Baixo">Baixo</option>
                  <option value="Normal">Normal</option>
                  <option value="Alto">Alto</option>
                  <option value="Máximo">Máximo</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  value={status}
                  onChange={(e) => {
                    const v = e.target.value;
                    setStatus(isStatusAtividade(v) ? v : "");
                  }}
                  className="border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-sm"
                >
                  <option value="">Selecione...</option>
                  <option value="Pendente">Pendente</option>
                  <option value="Concluído">Concluído</option>
                  <option value="Não Concluído">Não Concluído</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="foto-input">Foto</Label>
                {photoPreview ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <img src={photoPreview} alt="Prévia da foto" className="h-20 w-20 object-cover rounded-md border" />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRemovePhoto}
                        aria-label="Remover foto"
                        disabled={isCompressingPhoto}
                      >
                        <Trash2 /> Remover
                      </Button>
                    </div>
                    {photoSize !== null && (
                      <p className="text-xs text-muted-foreground">Tamanho aproximado: {formatBytes(photoSize)}</p>
                    )}
                  </div>
                ) : (
                  <>
                    <input
                      id="foto-input"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoChange}
                      aria-describedby="foto-descricao"
                      disabled={isCompressingPhoto}
                    />
                    <span id="foto-descricao" className="sr-only">Adicione uma foto para a atividade</span>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => document.getElementById("foto-input")?.click()}
                      aria-label="Adicionar foto"
                      disabled={isCompressingPhoto}
                    >
                      <Camera /> {isCompressingPhoto ? "Comprimindo imagem..." : "Adicionar foto"}
                    </Button>
                  </>
                )}
                {photoError ? (
                  <p className="text-xs text-destructive">{photoError}</p>
                ) : photoData === null ? (
                  <p className={`text-xs ${photoTouched ? "text-destructive" : "text-muted-foreground"}`}>
                    {photoTouched ? "Adicionar uma foto é obrigatório." : "Adicione uma foto (campo obrigatório)."}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="localizacao-button">Localização (obrigatória)</Label>
                <div className="flex flex-col gap-2">
                  <Button
                    id="localizacao-button"
                    variant="outline"
                    className="w-full"
                    onClick={handleUseCurrentLocation}
                    disabled={isLocating}
                    aria-describedby="localizacao-descricao location-feedback"
                  >
                    <MapPin /> {isLocating ? "Localizando..." : "Usar minha localização"}
                  </Button>
                  {(latInput !== "" || lngInput !== "") && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={handleClearLocation}
                      disabled={isLocating}
                    >
                      Limpar localização
                    </Button>
                  )}
                </div>
                <span id="localizacao-descricao" className="sr-only">Use a localização atual do dispositivo ou informe manualmente as coordenadas.</span>

                {/* {showCoordinateInputs && (
                  <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-6">
                    <div className="grid gap-1">
                      <Label htmlFor="latitude">Latitude</Label>
                      <Input
                        id="latitude"
                        value={latInput}
                        onChange={(event) => handleManualLatitudeChange(event.target.value)}
                        placeholder="-3.732700"
                        inputMode="decimal"
                        autoComplete="off"
                        aria-describedby="location-feedback"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="longitude">Longitude</Label>
                      <Input
                        id="longitude"
                        value={lngInput}
                        onChange={(event) => handleManualLongitudeChange(event.target.value)}
                        placeholder="-38.526700"
                        inputMode="decimal"
                        autoComplete="off"
                        aria-describedby="location-feedback"
                      />
                    </div>
                  </div>
                )} */}

                {hasCoordinates && (
                  <p className="text-xs text-muted-foreground">
                    Coordenadas atuais: {lat.toFixed(6)}, {lng.toFixed(6)}
                  </p>
                )}

                <p
                  id="location-feedback"
                  className={`text-xs ${
                    locationError || (locationTouched && !hasCoordinates)
                      ? "text-destructive"
                      : "text-muted-foreground"
                  }`}
                >
                  {locationError
                    ? locationError
                    : locationTouched && !hasCoordinates
                      ? "Não foi possível registrar as coordenadas automaticamente."
                      : hasCoordinates
                        ? "Coordenadas definidas automaticamente."
                        : "Use o botão para capturar sua localização atual."}
                </p>
              </div>

            </div>
          </div>

          <DialogFooter className="flex-row justify-end gap-2">
            <Button variant="outline" onClick={handleCancel} disabled={isSubmitting}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!canSave || isSubmitting}>
              {isSubmitting ? "Salvando..." : isEditing ? "Salvar alterações" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activity Detail Modal */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Atividade</DialogTitle>
            <DialogDescription className="sr-only">
              Modal com todas as informações sobre a atividade selecionada.
            </DialogDescription>
          </DialogHeader>
          
          {selectedActivity && (() => {
            const dataReferencia = selectedActivity.createdAt ? new Date(selectedActivity.createdAt) : null;
            const dataValida = dataReferencia && !Number.isNaN(dataReferencia.getTime()) ? dataReferencia : null;
            const dataFormatada = dataValida ? dataValida.toLocaleDateString('pt-BR') : "--";
            const horaFormatada = dataValida ? dataValida.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : "--";

            const dataAtualizacao = selectedActivity.updatedAt ? new Date(selectedActivity.updatedAt) : null;
            const atualizacaoValida = dataAtualizacao && !Number.isNaN(dataAtualizacao.getTime()) ? dataAtualizacao : null;
            const houveAtualizacao = Boolean(atualizacaoValida && (!dataValida || atualizacaoValida.getTime() > dataValida.getTime()));
            const atualizacaoFormatada = atualizacaoValida ? `${atualizacaoValida.toLocaleDateString('pt-BR')} às ${atualizacaoValida.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : null;

            const descricaoLimpa = selectedActivity.descricaoOriginal ?? selectedActivity.registro;
            const subLocaisLista = Array.isArray(selectedActivity.subLocais)
              ? selectedActivity.subLocais.filter((item) => Boolean(item?.trim()))
              : [];
            const possuiCoordenadas =
              typeof selectedActivity.lat === "number" && typeof selectedActivity.lng === "number";
            const mapsUrl = possuiCoordenadas
              ? `https://www.google.com/maps?q=${selectedActivity.lat},${selectedActivity.lng}`
              : null;

            const subLocaisFormatados = subLocaisLista.map((nome) => {
              if (!nome.toLowerCase().startsWith("bloco m")) {
                return nome;
              }

              const partes = nome.split(" - ").map((parte) => parte.trim());
              if (partes.length < 3) {
                return partes.slice(1).join(" - ") || partes[partes.length - 1] || nome;
              }

              return partes.slice(1).join(" - ") || nome;
            });

            return (
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-1 gap-3 text-sm text-gray-600">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-800">Funcionário</span>
                    <span>{selectedActivity.nome}</span>
                  </div>
                  {selectedActivity.fotoUrl && (
                    <div className="flex flex-col gap-2">
                      <span className="font-medium text-gray-800">Foto</span>
                      <img
                        src={selectedActivity.fotoUrl}
                        alt="Foto da atividade"
                        className="max-h-64 w-auto rounded-md border object-contain"
                      />
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-800">Local principal</span>
                    {selectedActivity.localPrincipal ? (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                        {selectedActivity.localPrincipal}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Não informado</span>
                    )}
                  </div>

                  <div className="flex justify-between items-center gap-4">
                    <span className="font-medium text-gray-800 whitespace-nowrap">Sub-locais</span>
                    {subLocaisFormatados.length > 0 ? (
                      <div className="flex flex-wrap justify-end gap-2">
                        {subLocaisFormatados.map((nome) => (
                          <span key={nome} className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded text-xs font-medium">
                            {nome}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Nenhum sub-local informado</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-medium text-gray-800 whitespace-nowrap">Localização</span>
                      {possuiCoordenadas ? (
                        <span className="text-sm text-gray-600">
                          {selectedActivity.lat?.toFixed(6)}, {selectedActivity.lng?.toFixed(6)}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Não informado</span>
                      )}
                    </div>
                    {possuiCoordenadas && mapsUrl ? (
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 px-3 text-xs"
                  onClick={() => window.open(mapsUrl, "_blank", "noopener,noreferrer")}
                        >
                          <MapPin className="mr-1 h-3 w-3" />
                          Abrir no Maps
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex justify-between">
                    <span className="font-medium text-gray-800">Data</span>
                    <span>{dataFormatada}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-800">Hora</span>
                    <span>{horaFormatada}</span>
                  </div>
                  {houveAtualizacao && (
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-800">Atualizado em</span>
                      <span className="text-right">
                        {atualizacaoFormatada ?? "--"}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Atividade registrada</h3>
                  <p className="rounded-md bg-gray-100 p-4 text-sm text-gray-700 whitespace-pre-line">
                    {descricaoLimpa}
                  </p>
                </div>

                {/* Exibe o feedback diretamente no modal quando houver um registro associado. */}
                {selectedActivityFeedback && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">Feedback do supervisor</h3>
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      <p className="font-semibold text-amber-900 flex flex-wrap items-center gap-2">
                        <span>{selectedActivityFeedback.authorName || "Supervisor"}</span>
                        {selectedActivityFeedback.createdAt ? (
                          <span className="text-xs font-normal text-amber-700">
                            {formatDateTime(selectedActivityFeedback.createdAt)}
                          </span>
                        ) : null}
                      </p>
                      <div
                        className="mt-2 space-y-2 text-sm leading-relaxed text-amber-900 [&_*]:break-words [&_*]:text-amber-900"
                        dangerouslySetInnerHTML={{
                          __html:
                            selectedActivityFeedback.contentHtml?.length
                              ? selectedActivityFeedback.contentHtml
                              : selectedActivityFeedback.contentText ?? "",
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          
      <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button 
          onClick={() => window.open('https://wa.me/5585999999999', '_blank', 'noopener,noreferrer')}
          className="bg-green-500 hover:bg-green-600 text-white"
        >
          <MessageCircle className="h-4 w-4" />
          Contato
        </Button>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Button variant="outline" onClick={closeActivityDetail}>Fechar</Button>
        </div>
      </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isFeedbackDialogOpen}
        onOpenChange={(open) => {
          setIsFeedbackDialogOpen(open);
          if (!open) {
            setIsLoadingFeedback(false);
            setFeedbackError(null);
            setLatestFeedback(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Feedback do supervisor</DialogTitle>
            <DialogDescription className="sr-only">
              Feedback enviado pelo supervisor para o fiscal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {isLoadingFeedback ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="ml-2 text-sm">Carregando feedback...</span>
              </div>
            ) : feedbackError ? (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {feedbackError}
              </p>
            ) : latestFeedback ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {latestFeedback.subject || "Feedback"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Enviado por{" "}
                    <span className="font-medium text-foreground">
                      {latestFeedback.authorName || latestFeedback.authorEmail || "Supervisor"}
                    </span>
                    {latestFeedback.createdAt
                      ? ` em ${formatDateTime(latestFeedback.createdAt)}`
                      : ""}
                  </p>
                </div>
                <div className="max-h-[50vh] overflow-y-auto rounded-md border border-input bg-muted/30 p-4">
                  {latestFeedback.contentHtml ? (
                    <div
                      className="space-y-3 text-sm leading-relaxed text-foreground [&_*]:break-words"
                      dangerouslySetInnerHTML={{ __html: latestFeedback.contentHtml }}
                    />
                  ) : (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {latestFeedback.contentText || "Sem conteúdo disponível."}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum feedback disponível.</p>
            )}
          </div>

          <DialogFooter className="mt-4 pt-3">
            <Button variant="outline" onClick={() => setIsFeedbackDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

  <Dialog
    open={isConfirmDeleteOpen}
    onOpenChange={(open) => {
      if (isDeleting) return;
      setIsConfirmDeleteOpen(open);
      if (!open) setPendingDelete(null);
    }}
  >
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Remover atividade</DialogTitle>
      </DialogHeader>
      <p className="text-sm text-muted-foreground">
        Tem certeza de que deseja remover esta atividade? Esta ação não pode ser desfeita.
      </p>
      <DialogFooter>
        <Button variant="outline" onClick={cancelDelete} disabled={isDeleting}>Cancelar</Button>
        <Button variant="destructive" onClick={confirmDelete} disabled={isDeleting}>
          {isDeleting ? "Removendo..." : "Remover"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
    </div>
  )
}