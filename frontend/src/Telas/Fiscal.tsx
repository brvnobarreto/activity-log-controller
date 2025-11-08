import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePageTitle } from "@/hooks/use-page-title";

import Overview from "./Overview";
import Atividades from "./Atividades";

export default function Fiscal() {
  usePageTitle("Painel Fiscal");

  return (
    <div className="p-4 gap-4 min-h-screen">
      <Tabs defaultValue="overview" className="flex flex-col h-full">
        <TabsList className="mx-auto">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="activities">Minhas atividades</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="flex-1">
          <div className="w-full h-full p-4 border rounded-lg">
            <Overview />
          </div>
        </TabsContent>
        <TabsContent value="activities">
          <div className="w-full h-full p-4 border rounded-lg">
            <Atividades title="Minhas atividades" filterByCurrentUser />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

