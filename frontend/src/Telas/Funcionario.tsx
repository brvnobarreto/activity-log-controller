import { useState } from "react";
import { usePageTitle } from "@/hooks/use-page-title";
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
import { MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";

type FuncionarioItem = {
  id: number;
  nomeCompleto: string;
  matricula: string;
  funcao: string;
  fotoUrl?: string;
};

const initialFuncionarios: FuncionarioItem[] = [
  { id: 1, nomeCompleto: "Maria Silva", matricula: "2023001", funcao: "Supervisora" },
  { id: 2, nomeCompleto: "João Santos", matricula: "2023002", funcao: "Fiscal" },
  { id: 3, nomeCompleto: "Ana Costa", matricula: "2023003", funcao: "Auxiliar" },
  { id: 4, nomeCompleto: "Carlos Oliveira", matricula: "2023004", funcao: "Coordenador" },
  { id: 5, nomeCompleto: "Fernanda Lima", matricula: "2023005", funcao: "Fiscal" },
  { id: 6, nomeCompleto: "Roberto Alves", matricula: "2023006", funcao: "Auxiliar" },
];

function getInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return (first + last).toUpperCase();
}

export default function Funcionario() {
  usePageTitle("Funcionários");

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [funcionarios, setFuncionarios] = useState<FuncionarioItem[]>(initialFuncionarios);
  const emAtividade = 7;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [matricula, setMatricula] = useState("");
  const [funcao, setFuncao] = useState("");

  const isEditing = editingId !== null;
  const canSave = nomeCompleto.trim() !== "" && matricula.trim() !== "" && funcao.trim() !== "";

  function openAddDialog() {
    setEditingId(null);
    setNomeCompleto("");
    setMatricula("");
    setFuncao("");
    setIsDialogOpen(true);
  }

  function openEditDialog(item: FuncionarioItem) {
    setEditingId(item.id);
    setNomeCompleto(item.nomeCompleto);
    setMatricula(item.matricula);
    setFuncao(item.funcao);
    setIsDialogOpen(true);
  }

  function handleCancel() {
    setIsDialogOpen(false);
    setEditingId(null);
    setNomeCompleto("");
    setMatricula("");
    setFuncao("");
  }

  function handleSave() {
    if (!canSave) return;

    if (isEditing) {
      setFuncionarios((prev) =>
        prev.map((f) =>
          f.id === editingId ? { ...f, nomeCompleto, matricula, funcao } : f
        )
      );
    } else {
      const nextId = funcionarios.length ? Math.max(...funcionarios.map((f) => f.id)) + 1 : 1;
      setFuncionarios((prev) => [
        ...prev,
        { id: nextId, nomeCompleto, matricula, funcao },
      ]);
    }
    handleCancel();
  }

  function handleRemove(id: number) {
    setFuncionarios((prev) => prev.filter((f) => f.id !== id));
  }

  return (
    <div className="space-y-6 p-4">
      <div>
        <p className="text-sm text-muted-foreground">Em atividade: {emAtividade}</p>
      </div>

      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "grid" | "list")}>
        <TabsList>
          <TabsTrigger value="grid">Bloco</TabsTrigger>
          <TabsTrigger value="list">Lista</TabsTrigger>
        </TabsList>

        <TabsContent value="grid">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {funcionarios.map((f) => (
              <Card key={f.id} className="relative overflow-hidden">
                <div className="absolute top-2 right-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Mais opções">
                        <MoreVertical />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog(f)}>
                        <Pencil /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onClick={() => handleRemove(f.id)}>
                        <Trash2 /> Remover
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <CardContent className="py-4">
                  <div className="flex flex-col items-center text-center gap-3">
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
            ))}
          </div>
        </TabsContent>

        <TabsContent value="list">
          <div className="space-y-4">
            <table className="w-full border-separate border-spacing-y-4">
              <thead>
                <tr className="text-left text-sm font-medium text-gray-600">
                  <th className="pb-3 w-4/12">Nome</th>
                  <th className="pb-3 w-3/12">Matrícula</th>
                  <th className="pb-3 w-3/12">Função</th>
                  <th className="pb-3 w-2/12 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {funcionarios.map((f) => (
                  <tr key={f.id}>
                    <td colSpan={4} className="p-0">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="grid grid-cols-12 gap-4 items-center">
                          <div className="col-span-4 flex items-center gap-3 font-medium">
                            <Avatar>
                              {f.fotoUrl ? (
                                <AvatarImage src={f.fotoUrl} alt={f.nomeCompleto} />
                              ) : (
                                <AvatarFallback>{getInitials(f.nomeCompleto)}</AvatarFallback>
                              )}
                            </Avatar>
                            <span>{f.nomeCompleto}</span>
                          </div>
                          <div className="col-span-3 text-sm text-gray-700">{f.matricula}</div>
                          <div className="col-span-3 text-sm text-gray-700">{f.funcao}</div>
                          <div className="col-span-2 flex justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" aria-label="Mais opções">
                                  <MoreVertical />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditDialog(f)}>
                                  <Pencil /> Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem variant="destructive" onClick={() => handleRemove(f.id)}>
                                  <Trash2 /> Remover
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="matricula">Matrícula</Label>
              <Input
                id="matricula"
                value={matricula}
                onChange={(e) => setMatricula(e.target.value)}
                placeholder="Digite a matrícula"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="funcao">Função</Label>
              <Input
                id="funcao"
                value={funcao}
                onChange={(e) => setFuncao(e.target.value)}
                placeholder="Digite a função"
              />
            </div>
          </div>

          <DialogFooter className="flex-row justify-end gap-2">
            <Button variant="outline" onClick={handleCancel}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!canSave}>
              {isEditing ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}