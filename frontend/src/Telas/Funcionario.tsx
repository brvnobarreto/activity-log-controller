// TELA: Funcionários - gestão de cadastro com cache para evitar re-fetch em navegação


import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { usePageTitle } from "@/hooks/use-page-title";
import { buildApiUrl, resolveApiBaseUrl } from "@/lib/api";
import { fetchWithCache, getCacheData, setCacheData, invalidateCache } from "@/lib/requestCache";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSessionToken } from "@/Auth/utils/sessionStorage";
import { MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/Auth/context/AuthContext";

type FuncionarioItem = {
  id: string;
  nomeCompleto: string;
  matricula: string;
  funcao: string;
  fotoUrl: string | null;
};

type ApiFuncionario = {
  id: string;
  nomeCompleto?: string | null;
  matricula?: string | null;
  funcao?: string | null;
  fotoUrl?: string | null;
  role?: string | null;
  perfil?: { role?: string | null } | null;
  profile?: { role?: string | null } | null;
  cargo?: { nome?: string | null } | null;
  roles?: unknown;
};

const EMPLOYEE_CACHE_TTL = 1000 * 60 * 2;

function buildEmployeesCacheKey(baseUrl: string | undefined, token: string) {
  return `${baseUrl ?? ""}::employees::${token}`;
}

export default function Funcionario() {
  usePageTitle("Funcionários");

  const apiBaseUrl = resolveApiBaseUrl();
  const { sessionUser } = useAuth();
  const resolvedRole = useMemo(() => {
    if (!sessionUser) return "";
    const sources: unknown[] = [
      sessionUser.role,
      sessionUser.perfil?.role,
      sessionUser.profile?.role,
      (sessionUser as { roles?: unknown }).roles,
    ];
    for (const source of sources) {
      const extracted = extractRoleFromStructure(source);
      if (extracted) {
        return extracted.trim();
      }
    }
    return "";
  }, [sessionUser]);

  const canManageAll = useMemo(() => {
    const normalizedRole = resolvedRole.trim().toLowerCase();
    if (!normalizedRole) return false;
    return normalizedRole === "supervisor";
  }, [resolvedRole]);

  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [funcionarios, setFuncionarios] = useState<FuncionarioItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [matricula, setMatricula] = useState("");
  const [funcao, setFuncao] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const emAtividade = funcionarios.length;
  const isEditing = editingId !== null;
  const canSave = nomeCompleto.trim() !== "" && matricula.trim() !== "" && funcao.trim() !== "";

  const resetFormFields = () => {
    setEditingId(null);
    setNomeCompleto("");
    setMatricula("");
    setFuncao("");
    setFormError(null);
  };

  /**
   * Busca a lista de funcionários utilizando cache temporal para evitar requisições duplicadas.
   * Quando force=true, ignora o cache e atualiza os dados diretamente da API.
   */
  const loadFuncionarios = useCallback(
    async ({ force = false }: { force?: boolean } = {}) => {
      const token = getSessionToken();
      if (!token) {
        setFuncionarios([]);
        setPageError(null);
        setIsLoading(false);
        return;
      }

      const cacheKey = buildEmployeesCacheKey(apiBaseUrl, token);

      if (!force) {
        const cached = getCacheData<FuncionarioItem[]>(cacheKey, EMPLOYEE_CACHE_TTL);
        if (cached) {
          setFuncionarios(cached);
          setPageError(null);
          setIsLoading(false);
          return;
        }
      }

      setIsLoading(true);
      setPageError(null);

      try {
        // Evita duplicar requisições enquanto ainda existe uma chamada em andamento com a mesma chave.
        const data = await fetchWithCache<FuncionarioItem[]>(
          cacheKey,
          async () => {
            const config = { headers: { Authorization: `Bearer ${token}` } };
            const response = await axios.get<{ employees: ApiFuncionario[] }>(
              buildApiUrl("/api/employees", apiBaseUrl),
              config,
            );
            const mapped = response.data.employees.map(mapApiFuncionarioToItem);
            setCacheData(cacheKey, mapped);
            return mapped;
          },
          { ttl: EMPLOYEE_CACHE_TTL, force },
        );
        setFuncionarios(data);
      } catch (error) {
        console.error("Erro ao carregar funcionários:", error);
        if (force) {
          invalidateCache(cacheKey);
        }
        setPageError("Não foi possível carregar os funcionários. Tente novamente em instantes.");
      } finally {
        setIsLoading(false);
      }
    },
    [apiBaseUrl],
  );

  // Carrega os funcionários assim que a tela entra em foco
  useEffect(() => {
    void loadFuncionarios();
  }, [loadFuncionarios]);

  function openAddDialog() {
    resetFormFields();
    setIsDialogOpen(true);
  }

  function openEditDialog(item: FuncionarioItem) {
    resetFormFields();
    setEditingId(item.id);
    setNomeCompleto(item.nomeCompleto);
    setMatricula(item.matricula);
    setFuncao(item.funcao);
    setIsDialogOpen(true);
  }

  function handleDialogToggle(open: boolean) {
    if (!open) {
      setIsDialogOpen(false);
      resetFormFields();
      return;
    }

    setIsDialogOpen(true);
    setFormError(null);
  }

  function handleCancel() {
    setIsDialogOpen(false);
    resetFormFields();
  }

  /**
   * Envia os dados do formulário para criar ou atualizar o funcionário,
   * mantendo a lista e o cache local sincronizados com a resposta da API.
   */
  async function handleSave() {
    if (!canSave || isSaving) return;

    const payload = {
      nomeCompleto: nomeCompleto.trim(),
      matricula: matricula.trim(),
      funcao: funcao.trim(),
    };

    setFormError(null);
    setIsSaving(true);

    try {
      const token = getSessionToken();
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : undefined;
      const cacheKey = token ? buildEmployeesCacheKey(apiBaseUrl, token) : null;

      if (isEditing && editingId) {
        const { data } = await axios.put<{ employee: ApiFuncionario }>(
          buildApiUrl(`/api/employees/${editingId}`, apiBaseUrl),
          payload,
          config,
        );
        const funcionarioAtualizado = mapApiFuncionarioToItem(data.employee);
        setFuncionarios((prev) => {
          const updated = prev.map((item) =>
            item.id === funcionarioAtualizado.id ? funcionarioAtualizado : item,
          );
          if (cacheKey) {
            setCacheData(cacheKey, updated);
          }
          return updated;
        });
      } else {
        const { data } = await axios.post<{ employee: ApiFuncionario }>(
          buildApiUrl("/api/employees", apiBaseUrl),
          payload,
          config,
        );
        const novoFuncionario = mapApiFuncionarioToItem(data.employee);
        setFuncionarios((prev) => {
          const updated = [novoFuncionario, ...prev];
          // Atualiza o cache imediatamente para manter a lista consistente mesmo sem novo fetch.
          if (cacheKey) {
            setCacheData(cacheKey, updated);
          }
          return updated;
        });
      }

      handleCancel();
    } catch (error) {
      console.error("Erro ao salvar funcionário:", error);
      const message = extractApiErrorMessage(
        error,
        isEditing
          ? "Não foi possível atualizar o funcionário. Tente novamente."
          : "Não foi possível criar o funcionário. Tente novamente.",
      );
      setFormError(message);
    } finally {
      setIsSaving(false);
    }
  }

  /**
   * Remove o funcionário selecionado e limpa o cache em memória para evitar dados desatualizados.
   */
  async function handleRemove(id: string) {
    if (deletingId === id) return;

    setDeletingId(id);
    setPageError(null);

    try {
      const token = getSessionToken();
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : undefined;
      const cacheKey = token ? buildEmployeesCacheKey(apiBaseUrl, token) : null;
      await axios.delete(buildApiUrl(`/api/employees/${id}`, apiBaseUrl), config);
      setFuncionarios((prev) => {
        const updated = prev.filter((f) => f.id !== id);
        // Refletimos a remoção no cache em memória para evitar inconsistências visuais.
        if (cacheKey) {
          setCacheData(cacheKey, updated);
        }
        return updated;
      });
    } catch (error) {
      console.error("Erro ao remover funcionário:", error);
      const message = extractApiErrorMessage(
        error,
        "Não foi possível remover o funcionário. Tente novamente.",
      );
      setPageError(message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6 p-4">
      <p className="text-sm text-muted-foreground">Em atividade: {emAtividade}</p>

      {pageError ? (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {pageError}
        </div>
      ) : null}

      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "grid" | "list")}> 
        <TabsList>
          <TabsTrigger value="grid">Bloco</TabsTrigger>
          <TabsTrigger value="list">Lista</TabsTrigger>
        </TabsList>

        <TabsContent value="grid">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {isLoading ? (
              <div className="col-span-full rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-muted-foreground">
                Carregando funcionários...
              </div>
            ) : funcionarios.length === 0 ? (
              <div className="col-span-full rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-muted-foreground">
                Nenhum funcionário cadastrado ainda.
              </div>
            ) : (
              funcionarios.map((f) => (
                <Card key={f.id} className="relative overflow-hidden">
                  <div className="absolute right-2 top-2">
          <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Mais opções">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={(event) => {
                            event.preventDefault();
                            openEditDialog(f);
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
              {canManageAll ? (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  disabled={deletingId === f.id}
                  onSelect={(event) => {
                    event.preventDefault();
                    handleRemove(f.id);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {deletingId === f.id ? "Removendo..." : "Remover"}
                </DropdownMenuItem>
              ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <CardContent className="py-4">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <Avatar className="h-16 w-16">
                        {f.fotoUrl ? (
                          <AvatarImage src={f.fotoUrl} alt={f.nomeCompleto} />
                        ) : (
                          <AvatarFallback>{getInitials(f.nomeCompleto)}</AvatarFallback>
                        )}
                      </Avatar>
                      <div>
                        <div className="font-medium">{f.nomeCompleto}</div>
                        <div className="text-sm text-muted-foreground">{f.funcao}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="list">
          <div className="space-y-4">
            <table className="w-full table-fixed border-separate border-spacing-y-4">
              <thead>
                <tr className="text-sm font-medium text-gray-600">
                  <th className="w-4/12 pb-3 px-3 text-left">Nome</th>
                  <th className="w-3/12 pb-3 px-3 text-center">Matrícula</th>
                  <th className="w-3/12 pb-3 px-3 text-left">Função</th>
                  <th className="w-2/12 pb-3 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="p-0">
                      <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-muted-foreground">
                        Carregando funcionários...
                      </div>
                    </td>
                  </tr>
                ) : funcionarios.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-0">
                      <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-muted-foreground">
                        Nenhum funcionário cadastrado ainda.
                      </div>
                    </td>
                  </tr>
                ) : (
                  funcionarios.map((f) => (
                    <tr key={f.id} className="align-middle">
                      <td className="bg-gray-50 px-3 py-3 first:rounded-l-lg first:pl-4">
                        <div className="flex items-center justify-start gap-3 font-medium">
                          <Avatar>
                            {f.fotoUrl ? (
                              <AvatarImage src={f.fotoUrl} alt={f.nomeCompleto} />
                            ) : (
                              <AvatarFallback>{getInitials(f.nomeCompleto)}</AvatarFallback>
                            )}
                          </Avatar>
                          <span>{f.nomeCompleto}</span>
                        </div>
                      </td>
                      <td className="bg-gray-50 px-3 py-3 text-center text-sm text-gray-700">
                        {f.matricula}
                      </td>
                      <td className="bg-gray-50 px-3 py-3 text-left text-sm text-gray-700">
                        {f.funcao}
                      </td>
                      <td className="bg-gray-50 px-3 py-3 last:rounded-r-lg last:pr-4">
                        <div className="flex justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label="Mais opções">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onSelect={(event) => {
                                  event.preventDefault();
                                  openEditDialog(f);
                                }}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                          {canManageAll ? (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              disabled={deletingId === f.id}
                              onSelect={(event) => {
                                event.preventDefault();
                                handleRemove(f.id);
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {deletingId === f.id ? "Removendo..." : "Remover"}
                            </DropdownMenuItem>
                          ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      <Button
        onClick={openAddDialog}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg"
        size="icon"
        aria-label="Adicionar funcionário"
      >
        <Plus className="h-6 w-6" />
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogToggle}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Editar funcionário" : "Adicionar funcionário"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="nome-completo">Nome completo</Label>
              <Input
                id="nome-completo"
                value={nomeCompleto}
                onChange={(e) => setNomeCompleto(e.target.value)}
                placeholder="Digite o nome completo"
                disabled={isSaving}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="matricula">Matrícula</Label>
              <Input
                id="matricula"
                value={matricula}
                onChange={(e) => setMatricula(e.target.value)}
                placeholder="Digite a matrícula"
                disabled={isSaving}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="funcao">Função</Label>
              <Input
                id="funcao"
                value={funcao}
                onChange={(e) => setFuncao(e.target.value)}
                placeholder="Digite a função"
                className=""
                disabled={!canManageAll || isSaving}
              />
            </div>

            {formError ? (
              <p className="text-sm text-destructive">{formError}</p>
            ) : null}
          </div>

          <DialogFooter className="flex-row justify-end gap-2">
            <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!canSave || isSaving}>
              {isSaving ? "Salvando..." : isEditing ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Converte o formato complexo retornado pela API em um item pronto para uso na interface.
 */
function mapApiFuncionarioToItem(funcionario: ApiFuncionario): FuncionarioItem {
  function extractFromRoles(value: unknown): string {
    if (!value) return "";
    if (typeof value === "string") return value.trim();
    if (Array.isArray(value)) {
      for (const item of value) {
        const s = extractFromRoles(item);
        if (s) return s;
      }
      return "";
    }
    if (typeof value === "object") {
      const obj = value as Record<string, unknown>;
      const primary = obj["primary"];
      if (typeof primary === "string" && primary.trim()) return primary.trim();
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === "boolean" && v) return k;
      }
      for (const v of Object.values(obj)) {
        const s = extractFromRoles(v);
        if (s) return s;
      }
    }
    return "";
  }

  const funcaoDerivada =
    funcionario.funcao?.trim() ||
    funcionario.role?.trim() ||
    funcionario.perfil?.role?.trim() ||
    funcionario.profile?.role?.trim() ||
    funcionario.cargo?.nome?.trim() ||
    extractFromRoles(funcionario.roles) ||
    "";

  return {
    id: funcionario.id,
    nomeCompleto: funcionario.nomeCompleto?.trim() || "Funcionário",
    matricula: funcionario.matricula?.trim() || "--",
    funcao: funcaoDerivada || "--",
    fotoUrl: funcionario.fotoUrl?.trim() || null,
  };
}

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

function getInitials(nome: string) {
  const initials = nome
    .split(" ")
    .filter(Boolean)
    .map((parte) => parte[0]!.toUpperCase())
    .slice(0, 2)
    .join("");

  return initials || "F";
}

function extractApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined;
    if (data?.message && data.message.trim().length > 0) {
      return data.message;
    }
  }

  return fallback;
}