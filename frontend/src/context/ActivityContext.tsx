/**
 * Context provider responsável por carregar, cachear e manipular as atividades.
 * Grande parte da lógica de caching vive aqui para evitar que cada tela faça
 * novas requisições toda vez que o usuário navega entre rotas.
 */

import axios from "axios"
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

import { getSessionToken } from "@/Auth/utils/sessionStorage"
import { useAuth } from "@/Auth/context/AuthContext"
import { buildApiUrl, resolveApiBaseUrl } from "@/lib/api"
import { fetchWithCache, getCacheData, setCacheData, invalidateCache } from "@/lib/requestCache"

export type StatusAtividade = "Pendente" | "Concluído" | "Não Concluído"
export type NivelAtividade = "Baixo" | "Normal" | "Alto" | "Máximo"

export type Atividade = {
  id: string
  nome: string
  registro: string
  descricaoOriginal?: string | null
  nivel: NivelAtividade
  status: StatusAtividade
  lat: number | null
  lng: number | null
  localPrincipal?: string | null
  subLocais?: string[]
  createdAt?: string | null
  createdBy?: string | null
  updatedAt?: string | null
  updatedBy?: string | null
  fotoUrl?: string | null
}

export type ActivityScope = "global" | "personal"

export type ActivityPayload = {
  nome?: string | null
  descricao: string
  descricaoOriginal?: string | null
  nivel: NivelAtividade
  status: StatusAtividade
  localPrincipal: string | null
  subLocais: string[]
  latitude?: number
  longitude?: number
  fotoUrl?: string | null
  createdBy?: string | null
  updatedBy?: string | null
}

type ApiActivity = {
  id: string
  nome?: string | null
  descricao?: string | null
  descricaoOriginal?: string | null
  nivel?: string | null
  status?: string | null
  localPrincipal?: string | null
  subLocais?: string[] | null
  location?: {
    latitude?: number | null
    longitude?: number | null
  } | null
  fotoUrl?: string | null
  createdAt?: string | null
  createdBy?: string | null
  updatedAt?: string | null
  updatedBy?: string | null
}

interface ActivityContextValue {
  activities: Atividade[]
  personalActivities: Atividade[]
  isLoading: boolean
  refresh: (force?: boolean) => Promise<void>
  createActivity: (scope: ActivityScope, payload: ActivityPayload) => Promise<Atividade>
  updateActivity: (scope: ActivityScope, id: string, payload: ActivityPayload) => Promise<Atividade>
  deleteActivity: (scope: ActivityScope, id: string) => Promise<void>
}

const ActivityContext = createContext<ActivityContextValue | undefined>(undefined)

function sortActivitiesByDate(list: Atividade[]) {
  return [...list].sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return dateB - dateA
  })
}

function normalize(value?: string | null) {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

function mapApiActivityToAtividade(activity: ApiActivity): Atividade {
  const nivel = isNivelAtividade(activity.nivel ?? "") ? (activity.nivel as NivelAtividade) : "Normal"
  const status = isStatusAtividade(activity.status ?? "") ? (activity.status as StatusAtividade) : "Pendente"

  return {
    id: activity.id,
    nome: activity.nome ?? "Usuário",
    registro: activity.descricao ?? "",
    descricaoOriginal: activity.descricaoOriginal ?? activity.descricao ?? "",
    nivel,
    status,
    lat: typeof activity.location?.latitude === "number" ? activity.location.latitude : null,
    lng: typeof activity.location?.longitude === "number" ? activity.location.longitude : null,
    localPrincipal: activity.localPrincipal ?? null,
    subLocais: Array.isArray(activity.subLocais) ? activity.subLocais : [],
    createdAt: activity.createdAt ?? null,
    createdBy: activity.createdBy ?? null,
    updatedAt: activity.updatedAt ?? null,
    updatedBy: activity.updatedBy ?? null,
    fotoUrl: activity.fotoUrl ?? null,
  }
}

function buildApiPayload(payload: ActivityPayload) {
  return {
    nome: payload.nome ?? undefined,
    name: payload.nome ?? undefined,
    descricao: payload.descricao,
    descricaoOriginal: payload.descricaoOriginal ?? payload.descricao,
    nivel: payload.nivel,
    status: payload.status,
    localPrincipal: payload.localPrincipal ?? null,
    subLocais: payload.subLocais,
    latitude: typeof payload.latitude === "number" ? payload.latitude : undefined,
    longitude: typeof payload.longitude === "number" ? payload.longitude : undefined,
    fotoUrl: payload.fotoUrl ?? null,
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export function isNivelAtividade(value: string): value is NivelAtividade {
  return value === "Baixo" || value === "Normal" || value === "Alto" || value === "Máximo"
}

// eslint-disable-next-line react-refresh/only-export-components
export function isStatusAtividade(value: string): value is StatusAtividade {
  return value === "Pendente" || value === "Concluído" || value === "Não Concluído"
}

export function ActivityProvider({ children }: { children: ReactNode }) {
  const { sessionUser } = useAuth()
  const [activities, setActivities] = useState<Atividade[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const apiBaseUrl = resolveApiBaseUrl()
  const activitiesCacheTtl = 1000 * 60 * 2

  const buildActivitiesCacheKey = useCallback(
    (token: string) => `${apiBaseUrl ?? ""}::activities::${token}`,
    [apiBaseUrl],
  )

  const fetchActivities = useCallback(
    async (force = false) => {
      const token = getSessionToken()
      if (!token) {
        setActivities([])
        return
      }

      const cacheKey = buildActivitiesCacheKey(token)

      if (!force) {
        const cached = getCacheData<Atividade[]>(cacheKey, activitiesCacheTtl)
        if (cached) {
          setActivities(cached)
          setIsLoading(false)
          return
        }
      }

      setIsLoading(true)
      try {
        // O fetchWithCache evita chamadas duplicadas enquanto outra tela ainda está aguardando a mesma resposta.
        const data = await fetchWithCache<Atividade[]>(
          cacheKey,
          async () => {
            const config = {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
            const response = await axios.get<{ activities: ApiActivity[] }>(
              buildApiUrl("/api/activities", apiBaseUrl),
              config,
            )
            const mapped = response.data.activities.map(mapApiActivityToAtividade)
            const sorted = sortActivitiesByDate(mapped)
            setCacheData(cacheKey, sorted)
            return sorted
          },
          { ttl: activitiesCacheTtl, force },
        )
        setActivities(data)
      } catch (error) {
        console.error("Erro ao buscar atividades:", error)
        if (force) {
          invalidateCache(cacheKey)
        }
      } finally {
        setIsLoading(false)
      }
    },
    [apiBaseUrl, activitiesCacheTtl, buildActivitiesCacheKey],
  )

  useEffect(() => {
    void fetchActivities()
  }, [fetchActivities, sessionUser?.uid])

  const refresh = useCallback(
    async (force = false) => {
      await fetchActivities(force)
    },
    [fetchActivities],
  )

  const createActivity = useCallback<
    ActivityContextValue["createActivity"]
  >(async (_scope, payload) => {
    const token = getSessionToken()
    if (!token) {
      throw new Error("Usuário não autenticado")
    }
    const config = token
      ? {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      : undefined

    const requestBody = buildApiPayload(payload)

    const { data } = await axios.post<{ activity: ApiActivity }>(
      buildApiUrl("/api/activities", apiBaseUrl),
      requestBody,
      config,
    )

    const created = mapApiActivityToAtividade(data.activity)
    // Sincroniza cache e estado local pós-inserção para manter a lista consistente em todas as telas.
    const cacheKey = buildActivitiesCacheKey(token)
    setActivities((prev) => {
      const updated = sortActivitiesByDate([created, ...prev.filter((item) => item.id !== created.id)])
      setCacheData(cacheKey, updated)
      return updated
    })
    return created
  }, [apiBaseUrl, buildActivitiesCacheKey])

  const updateActivity = useCallback<
    ActivityContextValue["updateActivity"]
  >(async (_scope, id, payload) => {
    const token = getSessionToken()
    if (!token) {
      throw new Error("Usuário não autenticado")
    }
    const config = token
      ? {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      : undefined

    const requestBody = buildApiPayload(payload)

    const { data } = await axios.put<{ activity: ApiActivity }>(
      buildApiUrl(`/api/activities/${id}`, apiBaseUrl),
      requestBody,
      config,
    )

    const updated = mapApiActivityToAtividade(data.activity)
    // Atualiza cache com item modificado para evitar refetch.
    const cacheKey = buildActivitiesCacheKey(token)
    setActivities((prev) => {
      const updatedList = sortActivitiesByDate(prev.map((item) => (item.id === updated.id ? updated : item)))
      setCacheData(cacheKey, updatedList)
      return updatedList
    })
    return updated
  }, [apiBaseUrl, buildActivitiesCacheKey])

  const deleteActivity = useCallback<
    ActivityContextValue["deleteActivity"]
  >(async (_scope, id) => {
    const token = getSessionToken()
    if (!token) {
      throw new Error("Usuário não autenticado")
    }
    const config = token
      ? {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      : undefined

    await axios.delete(buildApiUrl(`/api/activities/${id}`, apiBaseUrl), config)
    // Remoção também reflete no cache compartilhado.
    const cacheKey = buildActivitiesCacheKey(token)
    setActivities((prev) => {
      const updated = prev.filter((item) => item.id !== id)
      setCacheData(cacheKey, updated)
      return updated
    })
  }, [apiBaseUrl, buildActivitiesCacheKey])

  const personalActivities = useMemo(() => {
    if (!sessionUser) {
      return [] as Atividade[]
    }

    const identifiers = new Set<string>()

    if (sessionUser.email) identifiers.add(normalize(sessionUser.email))
    if (sessionUser.name) identifiers.add(normalize(sessionUser.name))
    if (sessionUser.uid) identifiers.add(normalize(sessionUser.uid))

    if (identifiers.size === 0) {
      return [] as Atividade[]
    }

    return activities.filter((activity) => {
      const candidates = [
        normalize(activity.createdBy),
        normalize(activity.updatedBy),
        normalize(activity.nome),
      ]

      return candidates.some((candidate) => candidate && identifiers.has(candidate))
    })
  }, [activities, sessionUser])

  const value = useMemo<ActivityContextValue>(
    () => ({
      activities,
      personalActivities,
      isLoading,
      refresh,
      createActivity,
      updateActivity,
      deleteActivity,
    }),
    [activities, personalActivities, isLoading, refresh, createActivity, updateActivity, deleteActivity]
  )

  return <ActivityContext.Provider value={value}>{children}</ActivityContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useActivityContext() {
  const context = useContext(ActivityContext)
  if (!context) {
    throw new Error("useActivityContext deve ser usado dentro de um ActivityProvider")
  }
  return context
}

