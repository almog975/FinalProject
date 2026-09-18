import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { apiDelete, apiGet, apiPost, apiPut } from '../api'
import { StatusBanner } from '../components/StatusBanner'
import type { Product } from '../types'

type EditState = {
  id: number
  name: string
  price: string
  stock: string
  description: string
} | null

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [name, setName] = useState('')
  const [price, setPrice] = useState('9.99')
  const [stock, setStock] = useState('10')
  const [description, setDescription] = useState('')
  const [edit, setEdit] = useState<EditState>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setProducts(await apiGet<Product[]>('/api/products'))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

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

  async function onCreate(e: FormEvent) {
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
      await load()
    })
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault()
    if (!edit) return
    await withBusy(async () => {
      await apiPut<Product>(`/api/products/${edit.id}`, {
        name: edit.name,
        price: Number(edit.price),
        stock: Number(edit.stock),
        description: edit.description.trim() || null,
      })
      setEdit(null)
      await load()
    })
  }

  async function onDelete(id: number) {
    if (!confirm(`Delete product #${id}?`)) return
    await withBusy(async () => {
      await apiDelete(`/api/products/${id}`)
      if (edit?.id === id) setEdit(null)
      await load()
    })
  }

  function startEdit(p: Product) {
    setEdit({
      id: p.id,
      name: p.name,
      price: String(p.price),
      stock: String(p.stock),
      description: p.description ?? '',
    })
  }

  return (
    <div className="page">
      <header className="page-header">
        <h2>Products</h2>
        <p className="muted">Create, edit, and delete catalog items via `/api/products`.</p>
      </header>

      <StatusBanner loading={loading} error={error} />

      <section className="card">
        <h3>Create product</h3>
        <form className="form" onSubmit={onCreate}>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required disabled={busy} />
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
              disabled={busy}
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
              disabled={busy}
            />
          </label>
          <label className="grow">
            Description
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={busy}
            />
          </label>
          <button type="submit" className="primary" disabled={busy}>
            Create
          </button>
        </form>
      </section>

      {edit && (
        <section className="card">
          <h3>Edit product #{edit.id}</h3>
          <form className="form" onSubmit={onSaveEdit}>
            <label>
              Name
              <input
                value={edit.name}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                required
                disabled={busy}
              />
            </label>
            <label>
              Price
              <input
                type="number"
                step="0.01"
                min="0"
                value={edit.price}
                onChange={(e) => setEdit({ ...edit, price: e.target.value })}
                required
                disabled={busy}
              />
            </label>
            <label>
              Stock
              <input
                type="number"
                min="0"
                value={edit.stock}
                onChange={(e) => setEdit({ ...edit, stock: e.target.value })}
                required
                disabled={busy}
              />
            </label>
            <label className="grow">
              Description
              <input
                value={edit.description}
                onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                disabled={busy}
              />
            </label>
            <button type="submit" className="primary" disabled={busy}>
              Save
            </button>
            <button type="button" disabled={busy} onClick={() => setEdit(null)}>
              Cancel
            </button>
          </form>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h3>Catalog</h3>
          <button type="button" disabled={busy || loading} onClick={() => void load()}>
            Refresh
          </button>
        </div>
        {!loading && products.length === 0 ? (
          <p className="muted">No products yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Description</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>
                      <strong>{p.name}</strong>
                    </td>
                    <td>${Number(p.price).toFixed(2)}</td>
                    <td>{p.stock}</td>
                    <td className="clamp">{p.description || '—'}</td>
                    <td className="actions">
                      <button type="button" disabled={busy} onClick={() => startEdit(p)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="danger"
                        disabled={busy}
                        onClick={() => void onDelete(p.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
