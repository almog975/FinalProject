/** API base URL. Empty string = same origin (Flask-served SPA / Vite proxy). */
const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

/** Concatenate API base + path (path should start with `/`). */
export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  if (!BASE) return p
  return `${BASE.replace(/\/$/, '')}${p}`
}

/** Human-readable env badge for the top bar. */
export function apiBaseLabel(): string {
  if (!BASE) return 'same-origin'
  return BASE
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

async function throwIfNotOk(res: Response): Promise<void> {
  if (res.ok) return
  const err = await res.json().catch(() => ({}))
  throw new Error((err as { error?: string }).error || `${res.status} ${res.statusText}`)
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(apiUrl(path))
  await throwIfNotOk(res)
  return parseJson<T>(res)
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  await throwIfNotOk(res)
  return parseJson<T>(res)
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  await throwIfNotOk(res)
  return parseJson<T>(res)
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(apiUrl(path), { method: 'DELETE' })
  await throwIfNotOk(res)
}

/** Fetch raw text (e.g. Prometheus /metrics). */
export async function apiGetText(path: string): Promise<string> {
  const res = await fetch(apiUrl(path))
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`)
  }
  return res.text()
}
