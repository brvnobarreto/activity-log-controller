/**
 * Lógica usada para memorizar respostas HTTP no browser e evitar requisições duplicadas.
 * O cache é propositalmente simples e fica apenas em memória, valendo para a sessão atual da SPA.
 */

const DEFAULT_TTL = 1000 * 60 * 2; // 2 minutes

type CacheEntry<T> = {
  data: T;
  timestamp: number;
  promise?: Promise<T>;
};

const cache = new Map<string, CacheEntry<unknown>>();

export type CacheOptions = {
  ttl?: number;
  force?: boolean;
};

/**
 * Retorna os dados em cache se ainda estiverem frescos, ou executa o fetcher e armazena o resultado.
 * Quando várias chamadas ocorrem ao mesmo tempo com a mesma chave, elas reaproveitam a mesma promise.
 */
export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {},
): Promise<T> {
  const { ttl = DEFAULT_TTL, force = false } = options;
  const existing = cache.get(key) as CacheEntry<T> | undefined;
  const now = Date.now();

  if (!force && existing) {
    if (existing.promise) {
      return existing.promise;
    }

    if (now - existing.timestamp <= ttl) {
      return existing.data;
    }
  }

  // Remove a entrada expirada e inicia um novo fetch; guardamos a promise para que outros aguardem a mesma resposta.
  const promise = fetcher();
  cache.set(key, {
    data: existing?.data as T,
    timestamp: existing?.timestamp ?? now,
    promise,
  });

  try {
    const data = await promise;
    cache.set(key, { data, timestamp: Date.now() });
    return data;
  } catch (error) {
    if (existing) {
      cache.set(key, existing);
    } else {
      cache.delete(key);
    }
    throw error;
  }
}

export function setCacheData<T>(key: string, data: T) {
  cache.set(key, { data, timestamp: Date.now() });
}

export function invalidateCache(key: string) {
  // Use após mutações para garantir que a próxima leitura faça um novo fetch.
  cache.delete(key);
}

export function getCacheData<T>(key: string, ttl: number = DEFAULT_TTL): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) {
    return null;
  }

  if (Date.now() - entry.timestamp > ttl) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}


