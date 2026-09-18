import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { apiGet, apiPost } from '../api'
import { StatusBanner } from '../components/StatusBanner'
import type { Cart, Order } from '../types'

export function OrdersPage() {
  const [userId, setUserId] = useState('alice')
  const [fetchId, setFetchId] = useState(() => localStorage.getItem('lastOrderId') ?? '')
  const [order, setOrder] = useState<Order | null>(null)
  const [cart, setCart] = useState<Cart | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const loadOrder = useCallback(async (id: number) => {
    const o = await apiGet<Order>(`/api/orders/${id}`)
    setOrder(o)
    localStorage.setItem('lastOrderId', String(o.id))
    setFetchId(String(o.id))
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const c = await apiGet<Cart>(`/api/cart/${userId}`)
        if (!cancelled) setCart(c)
        const raw = localStorage.getItem('lastOrderId')
        if (raw) {
          const o = await apiGet<Order>(`/api/orders/${Number(raw)}`)
          if (!cancelled) {
            setOrder(o)
            setFetchId(String(o.id))
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

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

  async function onFetch(e: FormEvent) {
    e.preventDefault()
    const id = Number(fetchId)
    if (!id) {
      setError('Enter a valid order id')
      return
    }
    await withBusy(async () => {
      await loadOrder(id)
    })
  }

  async function onPlaceOrder() {
    await withBusy(async () => {
      const o = await apiPost<Order>('/api/orders', { user_id: userId.trim() || 'alice' })
      setOrder(o)
      localStorage.setItem('lastOrderId', String(o.id))
      setFetchId(String(o.id))
      setCart(await apiGet<Cart>(`/api/cart/${userId.trim() || 'alice'}`))
    })
  }

  return (
    <div className="page">
      <header className="page-header">
        <h2>Orders</h2>
        <p className="muted">Fetch an order by id or place one from the current cart.</p>
      </header>

      <StatusBanner loading={loading} error={error} />

      <section className="card">
        <h3>Fetch by id</h3>
        <form className="form" onSubmit={onFetch}>
          <label>
            Order ID
            <input
              type="number"
              min="1"
              value={fetchId}
              onChange={(e) => setFetchId(e.target.value)}
              disabled={busy}
            />
          </label>
          <button type="submit" disabled={busy || !fetchId}>
            Fetch
          </button>
        </form>
      </section>

      <section className="card">
        <h3>Place order from cart</h3>
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault()
            void onPlaceOrder()
          }}
        >
          <label>
            User ID
            <input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              disabled={busy}
            />
          </label>
          <button
            type="submit"
            className="primary"
            disabled={busy || !cart || cart.item_count === 0}
          >
            Place order ({cart?.item_count ?? 0} items)
          </button>
        </form>
        {cart && cart.item_count === 0 && (
          <p className="muted">Cart is empty — add items on the Cart page first.</p>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h3>Order detail</h3>
          {order && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void withBusy(() => loadOrder(order.id))}
            >
              Refresh
            </button>
          )}
        </div>
        {!order ? (
          <p className="muted">No order loaded yet.</p>
        ) : (
          <>
            <p>
              <strong>#{order.id}</strong> · user <code>{order.user_id}</code> ·{' '}
              <span className="pill badge">{order.status}</span> · total $
              {Number(order.total).toFixed(2)}
            </p>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Unit price</th>
                    <th>Line</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((it) => (
                    <tr key={it.product_id}>
                      <td>#{it.product_id}</td>
                      <td>{it.quantity}</td>
                      <td>${Number(it.unit_price).toFixed(2)}</td>
                      <td>${(Number(it.unit_price) * it.quantity).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
