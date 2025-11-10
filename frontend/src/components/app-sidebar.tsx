import * as React from "react"
import { useEffect, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { LayoutDashboard, Users, BarChart3, MapPin } from "lucide-react"
import type { LucideIcon } from "lucide-react"
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
import { buildApiUrl, resolveApiBaseUrl } from "@/lib/api"

// Navigation data for the sidebar
type NavItem = {
  title: string
  url: string
  icon: LucideIcon
  rolesAllowed?: string[]
}

const data: { navItems: NavItem[] } = {
  navItems: [
    {
      title: "Atividades",
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
      rolesAllowed: ["supervisor"],
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
  const [userInfo, setUserInfo] = useState(() => sessionUser || getStoredUser<{ name?: string; email?: string; picture?: string; provider?: string; role?: string }>() || null)

  const apiBaseUrl = resolveApiBaseUrl()

  useEffect(() => {
    setUserInfo(sessionUser || getStoredUser<{ name?: string; email?: string; picture?: string; provider?: string; role?: string }>() || null)
  }, [sessionUser])

  useEffect(() => {
    const token = getSessionToken()
    if (!token) return

    const fetchUser = async () => {
      setLoadingUser(true)
      try {
        const { data } = await axios.get<{ user: { name?: string; email?: string; picture?: string; provider?: string; role?: string } }>(buildApiUrl("/api/auth/me", apiBaseUrl), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        const normalizedUser = {
          ...data.user,
          role: data.user.role || 'Usuário',
        }
        setUserInfo(normalizedUser)
        saveSession({ user: normalizedUser })
      } catch (error) {
        console.error("Não foi possível carregar o usuário atual:", error)
        refreshSessionUser()
      } finally {
        setLoadingUser(false)
      }
    }

    fetchUser()
  }, [apiBaseUrl, refreshSessionUser])

  const normalizedRole = userInfo?.role ? userInfo.role.trim().toLowerCase() : null
  const navItems = data.navItems.filter((item) => {
    if (!item.rolesAllowed || item.rolesAllowed.length === 0) {
      return true
    }
    if (!normalizedRole) {
      return false
    }
    return item.rolesAllowed.some((role) => role.trim().toLowerCase() === normalizedRole)
  })

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
              {navItems.map((item) => {
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
