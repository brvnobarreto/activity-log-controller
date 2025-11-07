/**
 * Rota protegida: garante que apenas usuários autenticados (Firebase) acessem
 * os módulos internos. Enquanto o estado de autenticação está carregando a
 * tela exibe um placeholder; se não houver usuário, redireciona para /login.
 */
import { Navigate, Outlet, useLocation } from "react-router-dom"

import { useAuth } from "../context/AuthContext"

export function ProtectedRoute() {
  const { firebaseUser, loading } = useAuth()
  const location = useLocation()

  // Enquanto o Firebase ainda responde sobre o usuário atual, mostramos um estado neutro
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="text-sm text-muted-foreground">Carregando...</span>
      </div>
    )
  }

  // Sem usuário autenticado? leva para a tela de login, preservando a rota original
  if (!firebaseUser) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}
