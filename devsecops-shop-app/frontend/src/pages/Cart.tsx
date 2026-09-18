import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiDelete, apiGet, apiPost } from '../api'
import { StatusBanner } from '../components/StatusBanner'
import type { Cart, Order, Product } from '../types'

export function CartPage() {
  const [userId, setUserId] = useState('alice')
  const [cart, setCart] = useState<Cart | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [productId, setProductId] = useState('')
  const [qty, setQty] = useState('1')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [lastOrder, setLastOrder] = useState<Order | null>(null)

  const load = useCallback(async (uid: string) => {
    setLoading(true)
    setError(null)
    try {
      const [c, plist] = await Promise.all([
        apiGet<Cart>(`/api/cart/${uid}`),
        apiGet<Product[]>('/api/products'),
      ])
      setCart(c)
      setProducts(plist)
      if (!productId && plist.length) setProductId(String(plist[0].id))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    void load(userId)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load on mount / user change via Load button
  }, [])

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

  async function onLoadUser(e: FormEvent) {
    e.preventDefault()
    await withBusy(async () => {
      await load(userId.trim() || 'alice')
    })
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault()
    await withBusy(async () => {
      await apiPost('/api/cart', {
        user_id: userId.trim() || 'alice',
        product_id: Number(productId),
        quantity: Number(qty),
      })
      await load(userId.trim() || 'alice')
    })
  }

  async function onRemove(pid: number) {
    await withBusy(async () => {
      await apiDelete(`/api/cart/${userId.trim() || 'alice'}/item/${pid}`)
      await load(userId.trim() || 'alice')
    })
  }

  async function onCheckout() {
    await withBusy(async () => {
      const order = await apiPost<Order>('/api/orders', {
        user_id: userId.trim() || 'alice',
      })
      localStorage.setItem('lastOrderId', String(order.id))
      setLastOrder(order)
      await load(userId.trim() || 'alice')
    })
  }

  const productName = (id: number) => products.find((p) => p.id === id)?.name ?? `Product #${id}`

  return (
    <div className="page">
      <header className="page-header">
        <h2>Cart</h2>
        <p className="muted">Manage cart items and checkout to create an order.</p>
      </header>

      <StatusBanner loading={loading} error={error} />

      <section className="card">
        <h3>User</h3>
        <form className="form" onSubmit={onLoadUser}>
          <label className="grow">
            User ID
            <input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              disabled={busy}
            />
          </label>
          <button type="submit" disabled={busy}>
            Load cart
          </button>
        </form>
      </section>

      <section className="card">
        <h3>Add product</h3>
        <form className="form" onSubmit={onAdd}>
          <label className="grow">
            Product
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              disabled={busy || products.length === 0}
              required
            >
              {products.length === 0 && <option value="">No products</option>}
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.id} {p.name} (stock {p.stock})
                </option>
              ))}
            </select>
          </label>
          <label>
            Qty
            <input
              type="number"
              min="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              disabled={busy}
              required
            />
          </label>
          <button type="submit" className="primary" disabled={busy || !productId}>
            Add
          </button>
        </form>
      </section>

      <section className="card">
        <div className="card-head">
          <h3>
            Items ({cart?.item_count ?? 0})
          </h3>
          <button
            type="button"
            className="primary"
            disabled={busy || !cart || cart.item_count === 0}
            onClick={() => void onCheckout()}
          >
            Checkout → order
          </button>
        </div>
        {!loading && (!cart || cart.item_count === 0) ? (
          <p className="muted">Cart is empty.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {cart?.items.map((item) => (
                  <tr key={item.product_id}>
                    <td>
                      <strong>{productName(item.product_id)}</strong>
                      <span className="meta">#{item.product_id}</span>
                    </td>
                    <td>{item.quantity}</td>
                    <td className="actions">
                      <button
                        type="button"
                        className="danger"
                        disabled={busy}
                        onClick={() => void onRemove(item.product_id)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {lastOrder && (
          <p className="success-note">
            Order <strong>#{lastOrder.id}</strong> placed — total $
            {Number(lastOrder.total).toFixed(2)}.{' '}
            <Link to="/orders">View orders →</Link>
          </p>
        )}
      </section>
    </div>
  )
}
