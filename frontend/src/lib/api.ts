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

function sanitizeBase(baseUrl: string | null) {
  if (!baseUrl) {
    return null
  }
  return baseUrl.replace(/\/+$/, "") || null
}

export function resolveApiBaseUrl(): string | null {
  // Em desenvolvimento, retornamos null para usar URLs relativas
  // Isso permite que o proxy do Vite redirecione /api para http://localhost:3001
  if (import.meta.env.DEV) {
    return null
  }

  // Em produção, verificamos primeiro se há uma URL configurada via variável de ambiente
  const envBase = getEnvBaseUrl()
  if (envBase) {
    return envBase
  }

  // Em produção, usamos o fallback de API dedicado
  return PROD_FALLBACK_BASE_URL
}

export function buildApiUrl(path: string, baseUrl: string | null = resolveApiBaseUrl()): string {
  const sanitizedPath = sanitizePath(path)
  
  // Se não há baseUrl (dev mode com proxy), retornamos URL relativa
  if (!baseUrl) {
    return sanitizedPath
  }

  const sanitizedBase = sanitizeBase(baseUrl)
  if (!sanitizedBase) {
    return sanitizedPath
  }

  try {
    return new URL(sanitizedPath, sanitizedBase).toString()
  } catch (error) {
    console.warn("Não foi possível construir URL com new URL, fallback para concatenação simples.", error)
    return `${sanitizedBase}${sanitizedPath}`
  }
}


