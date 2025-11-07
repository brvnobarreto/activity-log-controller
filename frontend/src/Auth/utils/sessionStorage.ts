/**
 * Helpers centralizados para ler/gravar dados da sessão de autenticação
 * (token da API, sessionId salvo pelo backend e snapshot do usuário) no
 * localStorage. Evita duplicação e mantém a mesma chave em toda a aplicação.
 */
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
  // Remove tudo relacionado à sessão atual
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
    // Se por algum motivo a conversão falhar, garantimos limpeza das informações
    localStorage.removeItem(USER_KEY)
    return null
  }
}
