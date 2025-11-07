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

const blocosDisponiveis = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "T", "X", "Z"];

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
  
  // Estados para local e sublocais
  const [localSelecionado, setLocalSelecionado] = useState<string>("");
  const [subLocaisSelecionados, setSubLocaisSelecionados] = useState<Record<string, boolean>>(
    subLocaisDisponiveis.reduce((acc, local) => ({ ...acc, [local.id]: false }), {})
  );
  
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Atividade | null>(null);
  
  const temSubLocalSelecionado = Object.values(subLocaisSelecionados).some((selecionado) => selecionado);
  
  // A descrição só pode ser editada se local e pelo menos um sublocal estiverem selecionados
  const podeEscreverDescricao = localSelecionado !== "" && temSubLocalSelecionado;
  
  const canSave = descricao.trim() !== "" && nivel !== "" && status !== "" && localSelecionado !== "" && temSubLocalSelecionado;

  function openAddDialog() {
    setDescricao("");
    setNivel("");
    setStatus("");
    setLat("");
    setLng("");
    setPhotoPreview(null);
    setLocalSelecionado("");
    setSubLocaisSelecionados(
      subLocaisDisponiveis.reduce((acc, local) => ({ ...acc, [local.id]: false }), {})
    );
    setIsDialogOpen(true);
  }

  function toggleSubLocal(localId: string) {
    setSubLocaisSelecionados((prev) => ({
      ...prev,
      [localId]: !prev[localId],
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

    const localPrincipal = locaisDisponiveis.find((local) => local.id === localSelecionado);
    const subLocaisAtivos = subLocaisDisponiveis.filter((subLocal) => subLocaisSelecionados[subLocal.id]);
    const prefixParts = [localPrincipal?.nome, ...subLocaisAtivos.map((subLocal) => subLocal.nome)].filter(Boolean);
    const descricaoTrim = descricao.trim();
    const descricaoComLocal = prefixParts.length
      ? `${prefixParts.join(" - ")} - ${descricaoTrim}`
      : descricaoTrim;

    const novaAtividade: Atividade = {
      id: nextId,
      nome: "Usuário",
      registro: descricaoComLocal,
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
        <DialogContent className="w-[calc(100%-2rem)] sm:w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar atividade</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 mt-4 mb-4">
            {/* Seleção de Local */}
            <div className="grid gap-2">
              <Label htmlFor="local">Local</Label>
              <select
                id="local"
                value={localSelecionado}
                onChange={(e) => setLocalSelecionado(e.target.value)}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 border rounded-md max-h-60 overflow-y-auto">
                  {subLocaisDisponiveis.map((subLocal) => (
                    <label key={subLocal.id} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={subLocaisSelecionados[subLocal.id] || false}
                        onChange={() => toggleSubLocal(subLocal.id)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <span className="text-sm">{subLocal.nome}</span>
                    </label>
                  ))}
                </div>
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
                  <div className="flex items-center gap-3">
                    <img src={photoPreview} alt="Prévia da foto" className="h-20 w-20 object-cover rounded-md border" />
                    <Button variant="outline" size="sm" onClick={handleRemovePhoto} aria-label="Remover foto">
                      <Trash2 /> Remover
                    </Button>
                  </div>
                ) : (
                  <>
                    <input id="foto-input" type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} aria-describedby="foto-descricao" />
                    <span id="foto-descricao" className="sr-only">Adicione uma foto para a atividade</span>
                    <Button variant="outline" className="w-full" onClick={() => document.getElementById("foto-input")?.click()} aria-label="Adicionar foto">
                      <Camera /> Adicionar foto
                    </Button>
                  </>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="localizacao-button">Localização</Label>
                <Button 
                  id="localizacao-button"
                  variant="outline"
                  className="w-full"
                  onClick={handleUseCurrentLocation} 
                  disabled={isLocating}
                  aria-describedby="localizacao-descricao"
                >
                  <MapPin /> {isLocating ? "Localizando..." : "Usar minha localização"}
                </Button>
                <span id="localizacao-descricao" className="sr-only">Usa a localização atual do dispositivo para registrar a atividade</span>
              </div>
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
            // Detectar local e sub-locais mencionados no registro
            const registroLower = selectedActivity.registro.toLowerCase();
            const localDetectado = locaisDisponiveis.find((local) =>
              local.termos.some((termo) => registroLower.includes(termo))
            );
            const subLocaisDetectados = subLocaisDisponiveis.filter((subLocal) =>
              subLocal.termos.some((termo) => registroLower.includes(termo))
            );
            
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
                  
                  {/* Local */}
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Local:</span>
                    {localDetectado ? (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium">
                        {localDetectado.nome}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Nenhum local específico detectado</span>
                    )}
                  </div>

                  {/* Sub-locais */}
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Sub-locais:</span>
                    <div className="flex flex-wrap gap-2 justify-end">
                      {subLocaisDetectados.length > 0 ? (
                        subLocaisDetectados.map((subLocal) => (
                          <span key={subLocal.id} className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded text-sm font-medium">
                            {subLocal.nome}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">Nenhum sub-local detectado</span>
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