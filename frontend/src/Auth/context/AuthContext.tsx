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

interface SessionUser {
  uid: string
  email: string
  name?: string
  picture?: string
  provider?: string
  emailVerified?: boolean
  role?: string
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

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001"

  useEffect(() => {
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
    const token = getSessionToken()
    if (!token) {
      setSessionUser(null)
      return
    }

    try {
      const { data } = await axios.get<{ user: SessionUser }>(`${apiBaseUrl}/api/auth/me`, {
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
    refreshSessionUser()
  }, [firebaseUser, refreshSessionUser])

  const signOutUser = useCallback(async () => {
    const token = getSessionToken()
    try {
      if (token) {
        await axios.post(
          `${apiBaseUrl}/api/auth/logout`,
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
