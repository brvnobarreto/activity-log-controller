import * as React from "react"
import { useEffect, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { LayoutDashboard, Users, BarChart3, MapPin } from "lucide-react"
import axios from "axios"

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
import { UserInfo } from "./ui/user-info"
import { getSessionToken, getStoredUser, saveSession } from "@/Auth/utils/sessionStorage"
import { useAuth } from "@/Auth/context/AuthContext"

// Navigation data for the sidebar
const data = {
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
  const { sessionUser, refreshSessionUser } = useAuth()
  const [loadingUser, setLoadingUser] = useState(false)
  const [userInfo, setUserInfo] = useState(() => sessionUser || getStoredUser<{ name?: string; email?: string; picture?: string; provider?: string }>() || null)

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001"

  useEffect(() => {
    setUserInfo(sessionUser || getStoredUser<{ name?: string; email?: string; picture?: string; provider?: string }>() || null)
  }, [sessionUser])

  useEffect(() => {
    const token = getSessionToken()
    if (!token) return

    const fetchUser = async () => {
      setLoadingUser(true)
      try {
        const { data } = await axios.get<{ user: { name?: string; email?: string; picture?: string; provider?: string } }>(`${apiBaseUrl}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        setUserInfo(data.user)
        saveSession({ user: data.user })
      } catch (error) {
        console.error("Não foi possível carregar o usuário atual:", error)
        refreshSessionUser()
      } finally {
        setLoadingUser(false)
      }
    }

    fetchUser()
  }, [apiBaseUrl, refreshSessionUser])

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <UserInfo user={userInfo} loading={loadingUser} />
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
        <NavUser user={userInfo} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
