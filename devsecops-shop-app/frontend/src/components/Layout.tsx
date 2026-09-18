import { NavLink, Outlet } from 'react-router-dom'
import { apiBaseLabel } from '../api'
import { useApiStatus } from '../hooks/useApiStatus'

const NAV = [
  { to: '/', label: 'Overview', end: true },
  { to: '/products', label: 'Products' },
  { to: '/cart', label: 'Cart' },
  { to: '/orders', label: 'Orders' },
  { to: '/security', label: 'Security' },
  { to: '/system', label: 'System' },
] as const

export function Layout() {
  const { health, ready } = useApiStatus()
  const healthOk = health?.status === 'ok'
  const readyOk = ready?.status === 'ready'

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">DS</span>
          <div>
            <strong>DevSecOps Shop</strong>
            <span className="brand-sub">Admin Dashboard</span>
          </div>
        </div>
        <nav className="nav" aria-label="Main">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? item.end : false}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <p className="sidebar-foot">Technion Final Project</p>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <div className="topbar-left">
            <h1 className="page-title">Shop Console</h1>
          </div>
          <div className="topbar-right" aria-live="polite">
            <span className={`pill ${healthOk ? 'ok' : 'bad'}`}>
              health: {health?.status ?? '…'}
            </span>
            <span className={`pill ${readyOk ? 'ok' : 'bad'}`}>
              ready: {ready?.status ?? '…'}
            </span>
            <span className="pill badge" title="VITE_API_BASE_URL">
              {apiBaseLabel()}
            </span>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
