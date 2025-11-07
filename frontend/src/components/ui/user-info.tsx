interface UserInfoProps {
  user?: {
    role?: string
    name?: string
    email?: string
    picture?: string
    provider?: string
  } | null
  loading?: boolean
}

export function UserInfo({ user, loading }: UserInfoProps) {
  return (
    <div className="flex items-center gap-2 p-2">
      <img
        src="/unifor-logo.svg"
        alt="Unifor Logo"
        className="h-8 w-8 rounded-lg object-contain"
      />
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">Activity Log Controller</span>
        <span className="truncate text-xs text-muted-foreground">
          {loading ? "Carregando..." : user?.role || "Função do usuário"}
        </span>
      </div>
    </div>
  )
}