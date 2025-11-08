import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePageTitle } from "@/hooks/use-page-title";
import Overview from "./Overview";
import Atividades from "./Atividades";

export default function Dashboard() {
  usePageTitle('Dashboard');

  const STORAGE_KEY = "dashboard:lastTab";

  const [activeTab, setActiveTab] = useState<"overview" | "activities">(() => {
    if (typeof window === "undefined") {
      return "overview";
    }

    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "activities" ? "activities" : "overview";
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, activeTab);
  }, [STORAGE_KEY, activeTab]);

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
          <TabsTrigger value="activities">Atividades</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="flex-1">
          <div className="w-full h-full p-4 border rounded-lg">
            <Overview/>
          </div>
        </TabsContent>
        <TabsContent value="activities">
          <div className="w-full h-full p-4 border rounded-lg">
            <Atividades/>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}