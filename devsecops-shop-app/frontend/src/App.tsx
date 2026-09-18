import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { CartPage } from './pages/Cart'
import { OrdersPage } from './pages/Orders'
import { OverviewPage } from './pages/Overview'
import { ProductsPage } from './pages/Products'
import { SecurityPage } from './pages/Security'
import { SystemPage } from './pages/System'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<OverviewPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="cart" element={<CartPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="security" element={<SecurityPage />} />
          <Route path="system" element={<SystemPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
