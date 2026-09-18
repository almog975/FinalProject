type Props = {
  loading?: boolean
  error?: string | null
  empty?: string | null
}

export function StatusBanner({ loading, error, empty }: Props) {
  if (error) {
    return (
      <div className="banner error" role="alert">
        {error}
      </div>
    )
  }
  if (loading) {
    return <div className="banner muted">Loading…</div>
  }
  if (empty) {
    return <p className="muted">{empty}</p>
  }
  return null
}
