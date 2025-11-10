const DEV_BASE_URL = "http://localhost:3001"
const PROD_FALLBACK_BASE_URL = "https://api-app-alc.onrender.com"

function sanitizePath(path: string) {
  if (!path) {
    return "/"
  }

  return path.startsWith("/") ? path : `/${path}`
}

function getEnvBaseUrl() {
  const value = import.meta.env?.VITE_API_BASE_URL
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim()
  }

  return null
}

function getWindowOrigin() {
  if (typeof window !== "undefined" && typeof window.location?.origin === "string") {
    return window.location.origin
  }

  return null
}

function sanitizeBase(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "") || DEV_BASE_URL
}

export function resolveApiBaseUrl() {
  if (import.meta.env.DEV) {
    return DEV_BASE_URL
  }

  const envBase = getEnvBaseUrl()
  if (envBase) {
    return envBase
  }

  // Em produção, preferimos usar o fallback de API dedicado
  // para evitar tentar chamar a própria origem do frontend.
  return PROD_FALLBACK_BASE_URL
}

export function buildApiUrl(path: string, baseUrl = resolveApiBaseUrl()) {
  const sanitizedBase = sanitizeBase(baseUrl)
  const sanitizedPath = sanitizePath(path)

  try {
    return new URL(sanitizedPath, sanitizedBase).toString()
  } catch (error) {
    console.warn("Não foi possível construir URL com new URL, fallback para concatenação simples.", error)
    return `${sanitizedBase}${sanitizedPath}`
  }
}


