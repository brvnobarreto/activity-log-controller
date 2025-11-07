import { createContext, useContext, useEffect, useMemo, useState } from "react"
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

  const refreshSessionUser = async () => {
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
  }

  useEffect(() => {
    if (!firebaseUser) return
    refreshSessionUser()
  }, [firebaseUser])

  const signOutUser = async () => {
    await signOut(auth)
    clearSession()
    setFirebaseUser(null)
    setSessionUser(null)
  }

  const value = useMemo<AuthContextValue>(
    () => ({ firebaseUser, sessionUser, loading, signOutUser, refreshSessionUser }),
    [firebaseUser, sessionUser, loading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider")
  }
  return context
}
