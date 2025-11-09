// TELA: Atividades - gerenciamento completo das ocorrências e formulários da operação
import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, MapPin, Plus, Trash2, MessageCircle, CheckCircle, Clock, XCircle, Pencil, MoreVertical } from "lucide-react";
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

type AtividadesProps = {
  title?: string;
  filterByCurrentUser?: boolean;
  autoOpenNew?: boolean;
};

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
  const normalizedRole = sessionUser?.role ? sessionUser.role.trim().toLowerCase() : undefined;
  const isFiscal = normalizedRole === "fiscal";
  const effectiveFilterByCurrentUser = filterByCurrentUser ?? isFiscal;
  const effectiveTitle = title ?? (isFiscal ? "Minhas Atividades" : "Atividades");
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

  const scope: ActivityScope = effectiveFilterByCurrentUser ? "personal" : "global";

  // Define a lista base (global ou pessoal) dependendo das props da tela
  const activities = useMemo(
    () => (effectiveFilterByCurrentUser ? personalActivities : globalActivities),
    [effectiveFilterByCurrentUser, personalActivities, globalActivities]
  );

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
  const [showCoordinateInputs, setShowCoordinateInputs] = useState(true);
  
  // Estados para local e sublocais
  const [localSelecionado, setLocalSelecionado] = useState<string>("");
  const [subLocaisSelecionados, setSubLocaisSelecionados] = useState<Record<string, string>>({});
  const [pavimentoSelecionado, setPavimentoSelecionado] = useState<string>("");
  
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Atividade | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Atividade | null>(null);
  
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

  // Função utilitária para limpar completamente o formulário da atividade
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
    setShowCoordinateInputs(true);
    setLocalSelecionado("");
    setSubLocaisSelecionados({});
    setPavimentoSelecionado("");
  }, []);

  // Preenche o formulário com os dados existentes quando estamos editando
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
    setShowCoordinateInputs(true);

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

  const startEditActivity = useCallback((activity: Atividade) => {
    resetForm();
    setEditingActivityId(activity.id);
    fillFormWithActivity(activity);
    setIsDialogOpen(true);
    setIsDetailOpen(false);
    setSelectedActivity(activity);
  }, [fillFormWithActivity, resetForm]);

  const handleDeleteActivity = useCallback((activity: Atividade) => {
    setPendingDelete(activity);
    setIsConfirmDeleteOpen(true);
  }, []);

  const cancelDelete = useCallback(() => {
    if (isDeleting) return;
    setIsConfirmDeleteOpen(false);
    setPendingDelete(null);
  }, [isDeleting]);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;

    setIsDeleting(true);
    try {
      await deleteActivity(scope, pendingDelete.id);

      if (selectedActivity?.id === pendingDelete.id) {
        setSelectedActivity(null);
        setIsDetailOpen(false);
      }

      if (editingActivityId === pendingDelete.id) {
        setEditingActivityId(null);
        resetForm();
      }
    } catch (error) {
      console.error("Erro ao remover atividade:", error);
    } finally {
      setIsDeleting(false);
      setIsConfirmDeleteOpen(false);
      setPendingDelete(null);
    }
  }, [deleteActivity, editingActivityId, pendingDelete, resetForm, scope, selectedActivity]);

  function handleCancel() {
    setIsDialogOpen(false);
    resetForm();
    setEditingActivityId(null);
  }

  function openActivityDetail(activity: Atividade) {
    setSelectedActivity(activity);
    setIsDetailOpen(true);
  }

  function closeActivityDetail() {
    setIsDetailOpen(false);
    setSelectedActivity(null);
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
            setShowCoordinateInputs(false);
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
      setShowCoordinateInputs(true);
    } finally {
      setIsLocating(false);
    }
  }

  function handleManualLatitudeChange(value: string) {
    if (!showCoordinateInputs) {
      setShowCoordinateInputs(true);
    }
    setLatInput(value);
    setLocationTouched(true);

    const normalized = value.replace(",", ".").trim();
    if (normalized === "" || normalized === "-" || normalized === "." || normalized === "-.") {
      setLat("");
      setLocationError("Informe latitude e longitude.");
      return;
    }

    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
      setLat("");
      setLocationError("Latitude inválida.");
      return;
    }

    if (parsed < -90 || parsed > 90) {
      setLat("");
      setLocationError("Latitude deve estar entre -90 e 90.");
      return;
    }

    const finalValue = Number(parsed.toFixed(6));
    setLat(finalValue);
    if (typeof lng === "number") {
      setLocationError(null);
    } else {
      setLocationError("Informe latitude e longitude.");
    }
  }

  function handleManualLongitudeChange(value: string) {
    if (!showCoordinateInputs) {
      setShowCoordinateInputs(true);
    }
    setLngInput(value);
    setLocationTouched(true);

    const normalized = value.replace(",", ".").trim();
    if (normalized === "" || normalized === "-" || normalized === "." || normalized === "-.") {
      setLng("");
      setLocationError("Informe latitude e longitude.");
      return;
    }

    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
      setLng("");
      setLocationError("Longitude inválida.");
      return;
    }

    if (parsed < -180 || parsed > 180) {
      setLng("");
      setLocationError("Longitude deve estar entre -180 e 180.");
      return;
    }

    const finalValue = Number(parsed.toFixed(6));
    setLng(finalValue);
    if (typeof lat === "number") {
      setLocationError(null);
    } else {
      setLocationError("Informe latitude e longitude.");
    }
  }

  function handleClearLocation() {
    setLat("");
    setLng("");
    setLatInput("");
    setLngInput("");
    setShowCoordinateInputs(true);
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
      <div>
        <h1 className="text-2xl font-bold mb-2">{effectiveTitle}</h1>
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

                    return (
                      <tr
                        key={atividade.id}
                        className="group align-middle cursor-pointer focus:outline-none"
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
                            {atividade.nome}
                          </td>
                        )}

                        <td
                          className={`bg-gray-50 px-4 py-4 text-left text-sm text-gray-600 transition-colors group-hover:bg-gray-100 ${
                            effectiveFilterByCurrentUser ? "rounded-l-lg" : ""
                          }`}
                        >
                          {atividade.localPrincipal ?? "--"}
                        </td>

                        <td className={`bg-gray-50 px-4 py-4 text-left text-sm text-gray-600 transition-colors group-hover:bg-gray-100 ${effectiveFilterByCurrentUser ? "" : ""}`}>
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
                          <div className="flex justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Mais opções"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenuItem
                                  onSelect={(event) => {
                                    event.preventDefault();
                                    const msg = encodeURIComponent(`Feedback sobre a atividade ${atividade.id}`);
                                    window.open(`https://wa.me/5585999999999?text=${msg}`, "_blank");
                                  }}
                                >
                                  <MessageCircle className="mr-2 h-4 w-4" />
                                  Feedback
                                </DropdownMenuItem>
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
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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

                {showCoordinateInputs && (
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
                )}

                {hasCoordinates && (
                  <p className="text-xs text-muted-foreground">
                    Coordenadas atuais: {lat.toFixed(6)}, {lng.toFixed(6)}
                  </p>
                )}

                <p
                  id="location-feedback"
                  className={`text-xs ${
                    locationError
                      ? "text-destructive"
                      : locationTouched && !hasCoordinates
                        ? "text-destructive"
                        : "text-muted-foreground"
                  }`}
                >
                  {locationError
                    ? locationError
                    : locationTouched && !hasCoordinates
                      ? "Informe latitude e longitude válidas."
                      : showCoordinateInputs
                        ? "Use o botão ou informe manualmente as coordenadas (latitude entre -90 e 90, longitude entre -180 e 180)."
                        : "Coordenadas preenchidas automaticamente. Clique em \"Limpar localização\" para editar manualmente."}
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
        <DialogContent className="max-w-md">
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
                          onClick={() => window.open(mapsUrl, "_blank")}
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
                  <h3 className="text-sm font-medium text-muted-foreground">Descrição registrada</h3>
                  <p className="rounded-md bg-gray-100 p-4 text-sm text-gray-700 whitespace-pre-line">
                    {descricaoLimpa}
                  </p>
                </div>
              </div>
            );
          })()}
          
      <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button 
          onClick={() => window.open('https://wa.me/5585999999999', '_blank')}
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