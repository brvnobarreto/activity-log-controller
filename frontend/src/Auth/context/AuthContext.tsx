import { createContext, useContext, useEffect, useMemo, useState } from "react"
import type { User } from "firebase/auth"
import { onAuthStateChanged, signOut } from "firebase/auth"

import { auth } from "@/lib/firebase"
import { clearSession } from "../utils/sessionStorage"

interface AuthContextValue {
  firebaseUser: User | null
  loading: boolean
  signOutUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const signOutUser = async () => {
    await signOut(auth)
    clearSession()
    setFirebaseUser(null)
  }

  const value = useMemo<AuthContextValue>(
    () => ({ firebaseUser, loading, signOutUser }),
    [firebaseUser, loading]
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
