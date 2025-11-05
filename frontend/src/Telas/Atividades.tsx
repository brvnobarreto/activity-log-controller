import { useState } from "react";
import { atividadesPorDia, type Atividade, type NivelAtividade, type StatusAtividade } from "@/data/atividades";
import { Link } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, MapPin, Plus, Trash2, MessageCircle, CheckCircle, Clock, XCircle } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

function isNivelAtividade(value: string): value is NivelAtividade {
  return value === "Baixo" || value === "Normal" || value === "Alto" || value === "Máximo";
}

function isStatusAtividade(value: string): value is StatusAtividade {
  return value === "Pendente" || value === "Concluído" || value === "Não Concluído";
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

// Dados de teste para atividades por dia
/* const atividadesPorDia = {
  "Hoje": [
    {
      id: 1,
      nome: "Maria Silva",
      registro: "Fiscalizando banheiro do segundo andar do bloco M",
      nivel: "Normal",
      status: "Concluído"
    },
    {
      id: 2,
      nome: "João Santos",
      registro: "No laboratório do bloco D",
      nivel: "Máximo",
      status: "Pendente"
    },
    {
      id: 3,
      nome: "Ana Costa",
      registro: "Limpeza da biblioteca central",
      nivel: "Normal",
      status: "Concluído"
    },
    {
      id: 4,
      nome: "Carlos Oliveira",
      registro: "Fiscalizando corredores do bloco A",
      nivel: "Máximo",
      status: "Não Concluído"
    },
    {
      id: 5,
      nome: "Fernanda Lima",
      registro: "No refeitório do bloco C",
      nivel: "Normal",
      status: "Pendente"
    },
    {
      id: 6,
      nome: "Roberto Alves",
      registro: "Fiscalizando salas de aula do bloco E",
      nivel: "Máximo",
      status: "Concluído"
    }
  ],
  "Ontem": [
    {
      id: 7,
      nome: "Patricia Mendes",
      registro: "Fiscalizando banheiro do primeiro andar do bloco B",
      nivel: "Normal",
      status: "Concluído"
    },
    {
      id: 8,
      nome: "Lucas Ferreira",
      registro: "No laboratório de química do bloco F",
      nivel: "Máximo",
      status: "Concluído"
    },
    {
      id: 9,
      nome: "Sandra Rodrigues",
      registro: "Limpeza do auditório principal",
      nivel: "Normal",
      status: "Concluído"
    },
    {
      id: 10,
      nome: "Marcos Pereira",
      registro: "Fiscalizando corredores do bloco G",
      nivel: "Máximo",
      status: "Não Concluído"
    },
    {
      id: 11,
      nome: "Carla Santos",
      registro: "No refeitório do bloco H",
      nivel: "Normal",
      status: "Concluído"
    },
    {
      id: 12,
      nome: "Antonio Silva",
      registro: "Fiscalizando salas de aula do bloco I",
      nivel: "Máximo",
      status: "Concluído"
    },
    {
      id: 13,
      nome: "Lucia Costa",
      registro: "No laboratório de informática do bloco J",
      nivel: "Normal",
      status: "Concluído"
    },
    {
      id: 14,
      nome: "Paulo Oliveira",
      registro: "Fiscalizando banheiro do terceiro andar do bloco K",
      nivel: "Máximo",
      status: "Concluído"
    },
    {
      id: 15,
      nome: "Rita Alves",
      registro: "Limpeza da sala de professores do bloco L",
      nivel: "Normal",
      status: "Concluído"
    },
    {
      id: 16,
      nome: "Jose Santos",
      registro: "No refeitório do bloco N",
      nivel: "Máximo",
      status: "Concluído"
    },
    {
      id: 17,
      nome: "Teresa Lima",
      registro: "Fiscalizando corredores do bloco O",
      nivel: "Normal",
      status: "Concluído"
    },
    {
      id: 18,
      nome: "Pedro Costa",
      registro: "No laboratório de física do bloco P",
      nivel: "Máximo",
      status: "Concluído"
    }
  ],
  "Anteontem": [
    {
      id: 19,
      nome: "Claudia Mendes",
      registro: "Fiscalizando banheiro do segundo andar do bloco Q",
      nivel: "Normal",
      status: "Concluído"
    },
    {
      id: 20,
      nome: "Rafael Silva",
      registro: "No laboratório de biologia do bloco R",
      nivel: "Máximo",
      status: "Concluído"
    },
    {
      id: 21,
      nome: "Beatriz Santos",
      registro: "Limpeza da sala de reuniões do bloco S",
      nivel: "Normal",
      status: "Concluído"
    },
    {
      id: 22,
      nome: "Diego Oliveira",
      registro: "Fiscalizando corredores do bloco T",
      nivel: "Máximo",
      status: "Concluído"
    },
    {
      id: 23,
      nome: "Juliana Costa",
      registro: "No refeitório do bloco U",
      nivel: "Normal",
      status: "Concluído"
    },
    {
      id: 24,
      nome: "Felipe Alves",
      registro: "Fiscalizando salas de aula do bloco V",
      nivel: "Máximo",
      status: "Concluído"
    },
    {
      id: 25,
      nome: "Camila Lima",
      registro: "No laboratório de matemática do bloco W",
      nivel: "Normal",
      status: "Concluído"
    },
    {
      id: 26,
      nome: "Gabriel Santos",
      registro: "Fiscalizando banheiro do primeiro andar do bloco X",
      nivel: "Máximo",
      status: "Concluído"
    }
  ]
}; */

export default function Atividades() {
  const isMobile = useIsMobile();
  const [dados, setDados] = useState<Record<string, Atividade[]>>(atividadesPorDia);
  const dias = Object.values(dados);
  const totalAtividades = dias.flat().length;
  const mediaSemanal = Math.round(totalAtividades / (dias.length || 1));

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [nivel, setNivel] = useState<NivelAtividade | "">("");
  const [status, setStatus] = useState<StatusAtividade | "">("");
  const [lat, setLat] = useState<number | "">("");
  const [lng, setLng] = useState<number | "">("");
  const [isLocating, setIsLocating] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  
  // Estados para bloco e locais
  const [blocoSelecionado, setBlocoSelecionado] = useState<string>("");
  const [locaisSelecionados, setLocaisSelecionados] = useState<{
    hall: boolean;
    sala: boolean;
    laboratorio: boolean;
    banheiros: boolean;
  }>({
    hall: false,
    sala: false,
    laboratorio: false,
    banheiros: false,
  });
  
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Atividade | null>(null);

  // Lista de blocos disponíveis
  const blocos = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
  
  // Verifica se pelo menos um local foi selecionado
  const temLocalSelecionado = locaisSelecionados.hall || locaisSelecionados.sala || locaisSelecionados.laboratorio || locaisSelecionados.banheiros;
  
  // A descrição só pode ser editada se bloco e pelo menos um local estiverem selecionados
  const podeEscreverDescricao = blocoSelecionado !== "" && temLocalSelecionado;
  
  const canSave = descricao.trim() !== "" && nivel !== "" && status !== "" && blocoSelecionado !== "" && temLocalSelecionado;

  function openAddDialog() {
    setDescricao("");
    setNivel("");
    setStatus("");
    setLat("");
    setLng("");
    setPhotoPreview(null);
    setBlocoSelecionado("");
    setLocaisSelecionados({
      hall: false,
      sala: false,
      laboratorio: false,
      banheiros: false,
    });
    setIsDialogOpen(true);
  }
  
  function toggleLocal(local: keyof typeof locaisSelecionados) {
    setLocaisSelecionados((prev) => ({
      ...prev,
      [local]: !prev[local],
    }));
  }

  function handleCancel() {
    setIsDialogOpen(false);
  }

  function openActivityDetail(activity: Atividade) {
    setSelectedActivity(activity);
    setIsDetailOpen(true);
  }

  function closeActivityDetail() {
    setIsDetailOpen(false);
    setSelectedActivity(null);
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function handleRemovePhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
  }

  async function handleUseCurrentLocation() {
    if (!("geolocation" in navigator)) return;
    try {
      setIsLocating(true);
      await new Promise<void>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setLat(Number(pos.coords.latitude.toFixed(6)));
            setLng(Number(pos.coords.longitude.toFixed(6)));
            resolve();
          },
          (err) => reject(err),
          { enableHighAccuracy: true, timeout: 8000 }
        );
      });
    } catch {
      // noop
    } finally {
      setIsLocating(false);
    }
  }

  function handleAdd() {
    if (!canSave) return;

    const all: Atividade[] = Object.values(dados).flat();
    const nextId = all.length ? Math.max(...all.map((a) => a.id)) + 1 : 1;

    const novaAtividade: Atividade = {
      id: nextId,
      nome: "Usuário",
      registro: descricao,
      nivel: (nivel || "Normal") as NivelAtividade,
      status: (status || "Pendente") as StatusAtividade,
      lat: typeof lat === "number" ? lat : 0,
      lng: typeof lng === "number" ? lng : 0,
    };

    setDados((prev) => {
      const hoje = prev["Hoje"] ?? [];
      return { ...prev, Hoje: [novaAtividade, ...hoje] };
    });

    handleCancel();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Atividades</h1>
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
      
      {Object.entries(dados).map(([dia, atividades]) => (
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
            <table className="w-full border-separate border-spacing-y-4">
              <thead>
                <tr className="text-left text-sm font-medium text-gray-600">
                  <th className="pb-3 w-3/12">Nome</th>
                  <th className="pb-3 w-5/12">Registro</th>
                  <th className="pb-3 w-2/12 text-center">Nível</th>
                  <th className="pb-3 w-2/12 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {atividades.map((atividade, index) => (
                  <tr key={atividade.id}>
                    <td colSpan={4} className="p-0">
                      <div 
                        className={`bg-gray-50 rounded-lg p-4 ${index === 0 ? 'cursor-pointer hover:bg-gray-100 transition-colors' : ''}`}
                        onClick={index === 0 ? () => openActivityDetail(atividade) : undefined}
                      >
                        <div className="grid grid-cols-12 gap-4 items-center">
                          <div className="col-span-3 font-medium">
                            {atividade.nome}
                          </div>
                          <div className="col-span-5 text-sm text-gray-600">
                            {atividade.registro}
                          </div>
                          <div className="col-span-2 flex justify-center">
                            {isMobile ? (
                              <div 
                                className={`h-6 w-6 rounded-full ${getNivelColor(atividade.nivel)}`}
                                aria-label={`Nível: ${atividade.nivel}`}
                                role="img"
                              />
                            ) : (
                              <span className={`px-2 py-1 rounded-full text-xs whitespace-nowrap ${
                                atividade.nivel === 'Máximo'
                                  ? 'bg-red-100 text-red-800'
                                  : atividade.nivel === 'Alto'
                                  ? 'bg-orange-100 text-orange-800'
                                  : atividade.nivel === 'Normal'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {atividade.nivel}
                              </span>
                            )}
                          </div>
                          <div className="col-span-2 flex justify-center">
                            {isMobile ? (
                              getStatusIcon(atividade.status)
                            ) : (
                              <span className={`px-2 py-1 rounded-full text-xs whitespace-nowrap ${
                                atividade.status === 'Concluído'
                                  ? 'bg-green-100 text-green-800'
                                  : atividade.status === 'Pendente'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {atividade.status}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      <Button
        onClick={openAddDialog}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg"
        size="icon"
        aria-label="Adicionar atividade"
      >
        <Plus className="h-6 w-6" />
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar atividade</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Seleção de Bloco */}
            <div className="grid gap-2">
              <Label htmlFor="bloco">Bloco</Label>
              <select
                id="bloco"
                value={blocoSelecionado}
                onChange={(e) => setBlocoSelecionado(e.target.value)}
                className="border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-sm"
              >
                <option value="">Selecione um bloco...</option>
                {blocos.map((bloco) => (
                  <option key={bloco} value={bloco}>
                    Bloco {bloco}
                  </option>
                ))}
              </select>
            </div>

            {/* Checkboxes de Locais */}
            {blocoSelecionado && (
              <div className="grid gap-2">
                <Label>Locais (selecione pelo menos um)</Label>
                <div className="grid grid-cols-2 gap-3 p-3 border rounded-md">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={locaisSelecionados.hall}
                      onChange={() => toggleLocal("hall")}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="text-sm">Hall</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={locaisSelecionados.sala}
                      onChange={() => toggleLocal("sala")}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="text-sm">Sala</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={locaisSelecionados.laboratorio}
                      onChange={() => toggleLocal("laboratorio")}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="text-sm">Laboratório</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={locaisSelecionados.banheiros}
                      onChange={() => toggleLocal("banheiros")}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="text-sm">Banheiros</span>
                  </label>
                </div>
              </div>
            )}

            {/* Descrição - só habilitada após selecionar bloco e locais */}
            <div className="grid gap-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Input
                id="descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder={podeEscreverDescricao ? "Descreva a atividade" : "Selecione um bloco e pelo menos um local primeiro"}
                disabled={!podeEscreverDescricao}
                className={!podeEscreverDescricao ? "opacity-50 cursor-not-allowed" : ""}
              />
              {!podeEscreverDescricao && (
                <p className="text-xs text-muted-foreground">
                  Selecione um bloco e pelo menos um local (hall, sala, laboratório ou banheiros) para habilitar a descrição.
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

            <div className="grid gap-2">
              <Label htmlFor="foto-input">Foto</Label>
              {photoPreview ? (
                <div className="flex items-center gap-3">
                  <img src={photoPreview} alt="Prévia da foto" className="h-20 w-20 object-cover rounded-md border" />
                  <Button variant="outline" size="sm" onClick={handleRemovePhoto} aria-label="Remover foto">
                    <Trash2 /> Remover
                  </Button>
                </div>
              ) : (
                <div>
                  <input id="foto-input" type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} aria-describedby="foto-descricao" />
                  <span id="foto-descricao" className="sr-only">Adicione uma foto para a atividade</span>
                  <Button variant="outline" onClick={() => document.getElementById("foto-input")?.click()} aria-label="Adicionar foto">
                    <Camera /> Adicionar foto
                  </Button>
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="localizacao-button">Localização</Label>
              <Button 
                id="localizacao-button"
                variant="outline" 
                onClick={handleUseCurrentLocation} 
                disabled={isLocating}
                aria-describedby="localizacao-descricao"
              >
                <MapPin /> {isLocating ? "Localizando..." : "Usar minha localização"}
              </Button>
              <span id="localizacao-descricao" className="sr-only">Usa a localização atual do dispositivo para registrar a atividade</span>
            </div>
          </div>

          <DialogFooter className="flex-row justify-end gap-2">
            <Button variant="outline" onClick={handleCancel}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={!canSave}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activity Detail Modal */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes da Atividade</DialogTitle>
          </DialogHeader>
          
          {selectedActivity && (() => {
            // Extrair bloco e locais do registro (mock de visualização)
            // Exemplo: "Fiscalizando banheiro do segundo andar do bloco M"
            const blocoMatch = selectedActivity.registro.match(/bloco\s+([A-Z])/i);
            const bloco = blocoMatch ? blocoMatch[1].toUpperCase() : "Não informado";
            
            // Detectar locais mencionados no registro
            const registroLower = selectedActivity.registro.toLowerCase();
            const locaisDetectados = {
              hall: registroLower.includes("hall"),
              sala: registroLower.includes("sala") || registroLower.includes("salas"),
              laboratorio: registroLower.includes("laboratório") || registroLower.includes("laboratorio"),
              banheiros: registroLower.includes("banheiro") || registroLower.includes("banheiros"),
            };
            
            return (
              <div className="space-y-4 py-2">
                {/* Photo placeholder */}
                <div className="w-full h-48 bg-gray-200 rounded-lg flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <Camera className="h-12 w-12 mx-auto mb-2" />
                    <p>Foto da atividade</p>
                  </div>
                </div>
                
                {/* Activity details */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Funcionário:</span>
                    <span>{selectedActivity.nome}</span>
                  </div>
                  
                  {/* Bloco */}
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Bloco:</span>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium">
                      Bloco {bloco}
                    </span>
                  </div>
                  
                  {/* Locais */}
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Locais:</span>
                    <div className="flex flex-wrap gap-2 justify-end">
                      {locaisDetectados.hall && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm font-medium">
                          Hall
                        </span>
                      )}
                      {locaisDetectados.sala && (
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm font-medium">
                          Sala
                        </span>
                      )}
                      {locaisDetectados.laboratorio && (
                        <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-sm font-medium">
                          Laboratório
                        </span>
                      )}
                      {locaisDetectados.banheiros && (
                        <span className="px-2 py-1 bg-pink-100 text-pink-800 rounded text-sm font-medium">
                          Banheiros
                        </span>
                      )}
                      {!locaisDetectados.hall && !locaisDetectados.sala && !locaisDetectados.laboratorio && !locaisDetectados.banheiros && (
                        <span className="text-sm text-muted-foreground">Nenhum local específico detectado</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Descrição:</span>
                    <span className="text-sm text-gray-600 text-right max-w-48">{selectedActivity.registro}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Nível:</span>
                    {isMobile ? (
                      <div 
                        className={`h-6 w-6 rounded-full ${getNivelColor(selectedActivity.nivel)}`}
                        aria-label={`Nível: ${selectedActivity.nivel}`}
                        role="img"
                      />
                    ) : (
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        selectedActivity.nivel === 'Máximo'
                          ? 'bg-red-100 text-red-800'
                          : selectedActivity.nivel === 'Alto'
                          ? 'bg-orange-100 text-orange-800'
                          : selectedActivity.nivel === 'Normal'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {selectedActivity.nivel}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Status:</span>
                    {isMobile ? (
                      getStatusIcon(selectedActivity.status)
                    ) : (
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        selectedActivity.status === 'Concluído'
                          ? 'bg-green-100 text-green-800'
                          : selectedActivity.status === 'Pendente'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {selectedActivity.status}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Data:</span>
                    <span>{new Date().toLocaleDateString('pt-BR')}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Hora:</span>
                    <span>{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </div>
            );
          })()}
          
          <DialogFooter className="flex-row justify-between">
            <Button 
              onClick={() => window.open('https://wa.me/5585999999999', '_blank')}
              className="bg-green-500 hover:bg-green-600 text-white"
            >
              <MessageCircle className="h-4 w-4" />
              Contato
            </Button>
            <Button variant="outline" onClick={closeActivityDetail}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}