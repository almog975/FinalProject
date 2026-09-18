/** API base URL. Empty string = same origin (Flask-served SPA / Vite proxy). */
const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

/** Concatenate API base + path (path should start with `/`). */
export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  if (!BASE) return p
  return `${BASE.replace(/\/$/, '')}${p}`
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(apiUrl(path))
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error || `${res.status} ${res.statusText}`)
  }
  return parseJson<T>(res)
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `${res.status} ${res.statusText}`)
  }
  return parseJson<T>(res)
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(apiUrl(path), { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || `${res.status} ${res.statusText}`)
  }
}
