import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../api'
import { StatusBanner } from '../components/StatusBanner'
import { useApiStatus } from '../hooks/useApiStatus'
import type { Cart, Order, Product } from '../types'

const USER_ID = 'alice'

export function OverviewPage() {
  const { health, ready } = useApiStatus()
  const [products, setProducts] = useState<Product[] | null>(null)
  const [cart, setCart] = useState<Cart | null>(null)
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const [plist, c] = await Promise.all([
          apiGet<Product[]>('/api/products'),
          apiGet<Cart>(`/api/cart/${USER_ID}`),
        ])
        let o: Order | null = null
        const raw = localStorage.getItem('lastOrderId')
        if (raw) {
          try {
            o = await apiGet<Order>(`/api/orders/${Number(raw)}`)
          } catch {
            o = null
          }
        }
        if (!cancelled) {
          setProducts(plist)
          setCart(c)
          setOrder(o)
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
  }, [])

  return (
    <div className="page">
      <header className="page-header">
        <h2>Overview</h2>
        <p className="muted">KPIs for the monolith shop API (products, cart, orders, probes).</p>
      </header>

      <StatusBanner loading={loading} error={error} />

      {!loading && !error && (
        <>
          <div className="kpi-grid">
            <div className="kpi-card">
              <span className="kpi-label">Products</span>
              <span className="kpi-value">{products?.length ?? 0}</span>
              <Link to="/products" className="kpi-link">
                Manage →
              </Link>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Cart items ({USER_ID})</span>
              <span className="kpi-value">{cart?.item_count ?? 0}</span>
              <Link to="/cart" className="kpi-link">
                Open cart →
              </Link>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Last order</span>
              <span className="kpi-value">
                {order ? `#${order.id}` : '—'}
              </span>
              <span className="kpi-meta">
                {order ? `$${Number(order.total).toFixed(2)} · ${order.status}` : 'None in this browser'}
              </span>
              <Link to="/orders" className="kpi-link">
                Orders →
              </Link>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">API probes</span>
              <span className="kpi-value small">
                {health?.status ?? '…'} / {ready?.status ?? '…'}
              </span>
              <Link to="/system" className="kpi-link">
                System →
              </Link>
            </div>
          </div>

          <section className="card">
            <h3>Quick links</h3>
            <div className="quick-links">
              <Link to="/products">Products</Link>
              <Link to="/cart">Cart</Link>
              <Link to="/orders">Orders</Link>
              <Link to="/security">SBOM &amp; scan</Link>
              <Link to="/system">Health / metrics</Link>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
