import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Outlet } from "react-router-dom";
import { useState, useEffect } from "react";
import { getCurrentTitle } from "@/hooks/use-page-title";
import { FeedbackSheet } from "@/components/feedback-sheet";

export default function AppLayout() {
  const [pageTitle, setPageTitle] = useState('Atividades');

  useEffect(() => {
    const handleTitleChange = (event: CustomEvent) => {
      setPageTitle(event.detail.title);
    };

    window.addEventListener('titleChanged', handleTitleChange as EventListener);
    
    // Define título inicial
    setPageTitle(getCurrentTitle() || 'Atividades');

    return () => {
      window.removeEventListener('titleChanged', handleTitleChange as EventListener);
    };
  }, []);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-13 items-center gap-3 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="data-[orientation=vertical]:h-4"
          />
          <h1 className="flex-1 text-center text-lg font-semibold">{pageTitle}</h1>
          <span aria-hidden="true" className="w-6" />
        </header>
        <FeedbackSheet showTrigger={false} />
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
