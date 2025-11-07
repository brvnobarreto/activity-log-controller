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

export default function AppLayout() {
  const [pageTitle, setPageTitle] = useState('Dashboard');

  useEffect(() => {
    const handleTitleChange = (event: CustomEvent) => {
      setPageTitle(event.detail.title);
    };

    window.addEventListener('titleChanged', handleTitleChange as EventListener);
    
    // Define título inicial
    setPageTitle(getCurrentTitle() || 'Dashboard');

    return () => {
      window.removeEventListener('titleChanged', handleTitleChange as EventListener);
    };
  }, []);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-13 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <h1 className="text-lg font-semibold text-center flex-1">{pageTitle}</h1>
        </header>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
