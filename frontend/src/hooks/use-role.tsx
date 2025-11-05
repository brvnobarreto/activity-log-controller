import { createContext, useContext, useMemo, useState, type ReactNode } from "react"

export type UserRole = "Supervisor" | "Fiscal"

type RoleContextValue = {
  role: UserRole
  setRole: (next: UserRole) => void
  toggleRole: () => void
  currentUserName: string
}

const RoleContext = createContext<RoleContextValue | null>(null)

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>("Supervisor")

  // Simple mock for current logged user name
  // Kept generic to match dataset entries like "Bruno Carvalho" (we filter by includes)
  const currentUserName = "Bruno"

  const value = useMemo<RoleContextValue>(() => ({
    role,
    setRole,
    toggleRole: () => setRole((prev) => (prev === "Fiscal" ? "Supervisor" : "Fiscal")),
    currentUserName,
  }), [role])

  return (
    <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
  )
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext)
  if (!ctx) {
    throw new Error("useRole must be used within a RoleProvider")
  }
  return ctx
}


