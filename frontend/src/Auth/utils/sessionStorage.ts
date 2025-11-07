const TOKEN_KEY = "alc_token"
const SESSION_KEY = "alc_session_id"
const USER_KEY = "alc_user"

interface SaveSessionOptions {
  token?: string
  sessionId?: string
  user?: unknown
}

export function saveSession({ token, sessionId, user }: SaveSessionOptions) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  }

  if (sessionId) {
    localStorage.setItem(SESSION_KEY, sessionId)
  }

  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem(USER_KEY)
}

export function getSessionToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getSessionId() {
  return localStorage.getItem(SESSION_KEY)
}

export function getStoredUser<T = unknown>() {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as T
  } catch (error) {
    console.error("Erro ao ler usuário do armazenamento local:", error)
    localStorage.removeItem(USER_KEY)
    return null
  }
}
