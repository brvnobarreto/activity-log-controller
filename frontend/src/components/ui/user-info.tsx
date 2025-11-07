interface UserInfoProps {
  user?: {
    name?: string
    email?: string
    picture?: string
    provider?: string
  } | null
  loading?: boolean
}

export function UserInfo({ user, loading }: UserInfoProps) {
  const displayName = user?.name || "Usuário"
  const displayEmail = user?.email || ""
  const avatarSrc = user?.picture || "/unifor-logo.svg"

  return (
    <div className="flex items-center gap-2 p-2">
      <img
        src={avatarSrc}
        alt={displayName}
        className="h-8 w-8 rounded-lg object-cover"
        referrerPolicy="no-referrer"
      />
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">
          {loading ? "Carregando..." : displayName}
        </span>
        {displayEmail ? (
          <span className="truncate text-xs text-muted-foreground">{displayEmail}</span>
        ) : null}
      </div>
    </div>
  )
}