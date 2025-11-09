/**
 * Contexto de autenticação do frontend.
 *
 * - Observa o usuário do Firebase via onAuthStateChanged.
 * - Sincroniza os dados da sessão com o backend (`/api/auth/me`).
 * - Expõe helpers para atualizar o perfil e realizar logout completo
 *   (Firebase + backend) em qualquer ponto da aplicação.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import type { User } from "firebase/auth"
import { onAuthStateChanged, signOut } from "firebase/auth"
import axios from "axios"

import { auth } from "@/lib/firebase"
import {
  clearSession,
  getSessionToken,
  getStoredUser,
  saveSession,
} from "../utils/sessionStorage"
import { buildApiUrl, resolveApiBaseUrl } from "@/lib/api"

interface SessionUser {
  uid: string
  email: string
  name?: string
  picture?: string
  provider?: string
  emailVerified?: boolean
  role?: string
  roles?: unknown
  perfil?: { role?: string | null } | null
  profile?: { role?: string | null } | null
}

interface AuthContextValue {
  firebaseUser: User | null
  sessionUser: SessionUser | null
  loading: boolean
  signOutUser: () => Promise<void>
  refreshSessionUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null)
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(getStoredUser<SessionUser>())
  const [loading, setLoading] = useState(true)

  const apiBaseUrl = resolveApiBaseUrl()

  useEffect(() => {
    // Assim que o Firebase avisa sobre mudança de usuário, iniciamos a busca
    // pelo perfil no backend. Se não houver session token, limpamos os dados locais.
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user)
      if (!user) {
        setSessionUser(null)
        clearSession()
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const refreshSessionUser = useCallback(async () => {
    // Busca o perfil detalhado do usuário no backend (nome, papel, etc.)
    const token = getSessionToken()
    if (!token) {
      setSessionUser(null)
      return
    }

    try {
      const { data } = await axios.get<{ user: SessionUser }>(buildApiUrl("/api/auth/me", apiBaseUrl), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      setSessionUser(data.user)
      saveSession({ user: data.user })
    } catch (error) {
      console.error("Erro ao buscar informações do usuário:", error)
      clearSession()
      setSessionUser(null)
    }
  }, [apiBaseUrl])

  useEffect(() => {
    if (!firebaseUser) return
    // Sempre que o Firebase autenticar um usuário, sincronizamos com a API
    refreshSessionUser()
  }, [firebaseUser, refreshSessionUser])

  const signOutUser = useCallback(async () => {
    // Logout completo: encerra sessão na API e também desloga no Firebase
    const token = getSessionToken()
    try {
      if (token) {
        await axios.post(
          buildApiUrl("/api/auth/logout", apiBaseUrl),
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )
      }
    } catch (error) {
      console.error('Erro ao encerrar sessão na API:', error)
    } finally {
      await signOut(auth)
      clearSession()
      setFirebaseUser(null)
      setSessionUser(null)
    }
  }, [apiBaseUrl])

  const value = useMemo<AuthContextValue>(
    () => ({ firebaseUser, sessionUser, loading, signOutUser, refreshSessionUser }),
    [firebaseUser, sessionUser, loading, signOutUser, refreshSessionUser]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider")
  }
  return context
}
