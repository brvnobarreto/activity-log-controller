import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import { LayoutDashboard, Users, BarChart3, MapPin } from "lucide-react"

import { SearchForm } from "@/components/search-form"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { NavUser } from "./ui/nav-user"
import { UserInfo } from "./ui/user-info";

// Navigation data for the sidebar
const data = {
  user: {
    name: "Bruno",
    role: "Supervisor",
    email: "bruno@example.com",
    avatar: "/avatars/bruno.jpg",
  },

  navItems: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "Funcionários",
      url: "/funcionario",
      icon: Users,
    },
    {
      title: "Relatórios",
      url: "/relatorios",
      icon: BarChart3,
    },
    {
      title: "Campus",
      url: "/campus",
      icon: MapPin,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const location = useLocation();

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <UserInfo user={data.user} />
      </SidebarHeader>
      <SidebarContent>
        <SearchForm />
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {data.navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={location.pathname === item.url} className="h-12">
                      <Link to={item.url} className="flex items-center gap-3">
                        <Icon className="h-4 w-4" />
                        {item.title}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
