import { Navigate, Outlet, useLocation } from "react-router-dom"

import { useAuth } from "../context/AuthContext"

export function ProtectedRoute() {
  const { firebaseUser, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="text-sm text-muted-foreground">Carregando...</span>
      </div>
    )
  }

  if (!firebaseUser) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}
