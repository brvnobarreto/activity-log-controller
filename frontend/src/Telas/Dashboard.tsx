// TELA: Dashboard - ponto central com navegação entre visão geral e atividades
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePageTitle } from "@/hooks/use-page-title";
import Overview from "./Overview";
import Atividades from "./Atividades";
import { useLocation } from "react-router-dom";

export default function Dashboard() {
  usePageTitle('Atividades');

  const STORAGE_KEY = "dashboard:lastTab";
  const location = useLocation();

  // Decide a aba inicial com base na rota atual ou no último valor salvo
  const [activeTab, setActiveTab] = useState<"overview" | "activities">(() => {
    if (location.pathname.startsWith("/atividades")) {
      return "activities";
    }
    if (typeof window === "undefined") {
      return "overview";
    }
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "activities" ? "activities" : "overview";
  });

  // Mantém o valor selecionado entre navegações usando localStorage
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, activeTab);
  }, [STORAGE_KEY, activeTab]);

  // Garante que, navegando para /atividades ou /atividades/nova, a aba de Atividades esteja ativa
  // Redirecionamentos que entram por /atividades garantem que abrimos a aba correta
  useEffect(() => {
    if (location.pathname.startsWith("/atividades")) {
      setActiveTab("activities");
    }
  }, [location.pathname]);

  // Flag responsável por abrir o diálogo de nova atividade automaticamente quando navegar para /atividades/nova
  const autoOpenNew = location.pathname === "/atividades/nova";

  return (
    <div className="p-4 gap-4 min-h-screen">
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          if (value === "overview" || value === "activities") {
            setActiveTab(value);
          }
        }}
        className="flex flex-col h-full"
      >
        <TabsList className="mx-auto">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="activities">Dashboard</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="flex-1">
          <div className="w-full h-full p-4 border rounded-lg">
            <Overview/>
          </div>
        </TabsContent>
        <TabsContent value="activities">
          <div className="w-full h-full p-4 border rounded-lg">
            <Atividades autoOpenNew={autoOpenNew}/>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}