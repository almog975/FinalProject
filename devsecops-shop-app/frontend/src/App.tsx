import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { apiDelete, apiGet, apiPost, apiUrl } from './api'
import type {
  Cart,
  HealthStatus,
  Order,
  Product,
  SecurityEnvelope,
} from './types'
import './App.css'

const USER_ID = 'alice'

function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [ready, setReady] = useState<HealthStatus | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<Cart | null>(null)
  const [lastOrder, setLastOrder] = useState<Order | null>(null)
  const [lastOrderId, setLastOrderId] = useState<number | null>(() => {
    const raw = localStorage.getItem('lastOrderId')
    return raw ? Number(raw) : null
  })
  const [sbom, setSbom] = useState<SecurityEnvelope | null>(null)
  const [scan, setScan] = useState<SecurityEnvelope | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [name, setName] = useState('')
  const [price, setPrice] = useState('9.99')
  const [stock, setStock] = useState('10')
  const [description, setDescription] = useState('')
  const [qtyByProduct, setQtyByProduct] = useState<Record<number, string>>({})

  const loadProducts = useCallback(async () => {
    const list = await apiGet<Product[]>('/api/products')
    setProducts(list)
  }, [])

  const loadCart = useCallback(async () => {
    const c = await apiGet<Cart>(`/api/cart/${USER_ID}`)
    setCart(c)
  }, [])

  const loadSecurity = useCallback(async () => {
    const [s, sc] = await Promise.all([
      apiGet<SecurityEnvelope>('/api/security/sbom'),
      apiGet<SecurityEnvelope>('/api/security/scan-report'),
    ])
    setSbom(s)
    setScan(sc)
  }, [])

  const loadOrder = useCallback(async (id: number) => {
    const o = await apiGet<Order>(`/api/orders/${id}`)
    setLastOrder(o)
  }, [])

  useEffect(() => {
    const pollStatus = async (path: '/health' | '/ready'): Promise<HealthStatus> => {
      try {
        const res = await fetch(apiUrl(path))
        const body = (await res.json().catch(() => ({}))) as HealthStatus
        if (!res.ok) {
          return { status: body.status || 'error', error: body.error }
        }
        return body
      } catch {
        return { status: path === '/health' ? 'down' : 'not_ready' }
      }
    }
    const poll = async () => {
      const [h, r] = await Promise.all([pollStatus('/health'), pollStatus('/ready')])
      setHealth(h)
      setReady(r)
    }
    poll()
    const id = setInterval(poll, 5000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        setError(null)
        await Promise.all([loadProducts(), loadCart(), loadSecurity()])
        if (lastOrderId) await loadOrder(lastOrderId)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })()
  }, [loadProducts, loadCart, loadSecurity, loadOrder, lastOrderId])

  async function withBusy(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function onCreateProduct(e: FormEvent) {
    e.preventDefault()
    await withBusy(async () => {
      await apiPost<Product>('/api/products', {
        name,
        price: Number(price),
        stock: Number(stock),
        ...(description.trim() ? { description: description.trim() } : {}),
      })
      setName('')
      setDescription('')
      await loadProducts()
    })
  }

  async function onAddToCart(productId: number) {
    const qty = Number(qtyByProduct[productId] ?? '1')
    await withBusy(async () => {
      await apiPost('/api/cart', {
        user_id: USER_ID,
        product_id: productId,
        quantity: qty,
      })
      await loadCart()
    })
  }

  async function onRemoveFromCart(productId: number) {
    await withBusy(async () => {
      await apiDelete(`/api/cart/${USER_ID}/item/${productId}`)
      await loadCart()
    })
  }

  async function onPlaceOrder() {
    await withBusy(async () => {
      const order = await apiPost<Order>('/api/orders', { user_id: USER_ID })
      setLastOrderId(order.id)
      localStorage.setItem('lastOrderId', String(order.id))
      setLastOrder(order)
      await Promise.all([loadCart(), loadProducts()])
    })
  }

  const sbomArtifact = sbom?.artifact as
    | { bomFormat?: string; components?: unknown[] }
    | undefined
  const scanSummary = (scan?.artifact as { summary?: Record<string, number> } | undefined)
    ?.summary

  return (
    <div className="app">
      <header className="header">
        <h1>DevSecOps Shop</h1>
        <p className="subtitle">Technion Final Project — demo UI (user: {USER_ID})</p>
      </header>

      <section className="health-strip" aria-live="polite">
        <span className={`pill ${health?.status === 'ok' ? 'ok' : 'bad'}`}>
          health: {health?.status ?? '…'}
        </span>
        <span className={`pill ${ready?.status === 'ready' ? 'ok' : 'bad'}`}>
          ready: {ready?.status ?? '…'}
        </span>
        {busy && <span className="pill muted">working…</span>}
      </section>

      {error && (
        <div className="banner error" role="alert">
          {error}
        </div>
      )}

      <main className="grid">
        <section className="card">
          <h2>Products</h2>
          <form className="form" onSubmit={onCreateProduct}>
            <label>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label>
              Price
              <input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </label>
            <label>
              Stock
              <input
                type="number"
                min="0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                required
              />
            </label>
            <label className="grow">
              Description (optional)
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <button type="submit" disabled={busy}>
              Create
            </button>
          </form>
          <ul className="list">
            {products.length === 0 && <li className="muted">No products yet.</li>}
            {products.map((p) => (
              <li key={p.id} className="row">
                <div>
                  <strong>{p.name}</strong>
                  <span className="meta">
                    #{p.id} · ${p.price.toFixed(2)} · stock {p.stock}
                  </span>
                  {p.description && <p className="desc">{p.description}</p>}
                </div>
                <div className="actions">
                  <input
                    type="number"
                    min="1"
                    className="qty"
                    value={qtyByProduct[p.id] ?? '1'}
                    onChange={(e) =>
                      setQtyByProduct((m) => ({ ...m, [p.id]: e.target.value }))
                    }
                    aria-label={`Quantity for ${p.name}`}
                  />
                  <button
                    type="button"
                    disabled={busy || p.stock < 1}
                    onClick={() => onAddToCart(p.id)}
                  >
                    Add to cart
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2>Cart ({USER_ID})</h2>
          <ul className="list">
            {!cart || cart.item_count === 0 ? (
              <li className="muted">Cart is empty.</li>
            ) : (
              cart.items.map((item) => (
                <li key={item.product_id} className="row">
                  <div>
                    <strong>Product #{item.product_id}</strong>
                    <span className="meta">qty {item.quantity}</span>
                  </div>
                  <button
                    type="button"
                    className="danger"
                    disabled={busy}
                    onClick={() => onRemoveFromCart(item.product_id)}
                  >
                    Remove
                  </button>
                </li>
              ))
            )}
          </ul>
          <button
            type="button"
            className="primary"
            disabled={busy || !cart || cart.item_count === 0}
            onClick={onPlaceOrder}
          >
            Place order
          </button>
        </section>

        <section className="card">
          <h2>Last order</h2>
          {!lastOrder ? (
            <p className="muted">No order placed in this browser yet.</p>
          ) : (
            <div>
              <p>
                <strong>#{lastOrder.id}</strong> · {lastOrder.status} · total $
                {Number(lastOrder.total).toFixed(2)}
              </p>
              <ul className="list compact">
                {lastOrder.items.map((it) => (
                  <li key={it.product_id}>
                    product #{it.product_id} × {it.quantity} @ $
                    {Number(it.unit_price).toFixed(2)}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={busy}
                onClick={() => withBusy(() => loadOrder(lastOrder.id))}
              >
                Refresh
              </button>
            </div>
          )}
        </section>

        <section className="card">
          <h2>Security</h2>
          <div className="security-grid">
            <div className="sec-card">
              <h3>SBOM</h3>
              {!sbom ? (
                <p className="muted">Loading…</p>
              ) : (
                <>
                  <p className="meta">
                    kind: {sbom.kind} · source: {sbom.source}
                  </p>
                  <ul className="compact">
                    <li>bomFormat: {String(sbomArtifact?.bomFormat ?? '—')}</li>
                    <li>
                      components:{' '}
                      {Array.isArray(sbomArtifact?.components)
                        ? sbomArtifact!.components!.length
                        : '—'}
                    </li>
                  </ul>
                </>
              )}
            </div>
            <div className="sec-card">
              <h3>Scan report</h3>
              {!scan ? (
                <p className="muted">Loading…</p>
              ) : (
                <>
                  <p className="meta">
                    kind: {scan.kind} · source: {scan.source}
                  </p>
                  <ul className="compact">
                    <li>critical: {scanSummary?.critical ?? '—'}</li>
                    <li>high: {scanSummary?.high ?? '—'}</li>
                    <li>medium: {scanSummary?.medium ?? '—'}</li>
                    <li>low: {scanSummary?.low ?? '—'}</li>
                    <li>total: {scanSummary?.total ?? '—'}</li>
                  </ul>
                </>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
