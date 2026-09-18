import { useEffect, useState } from 'react'
import { apiGet } from '../api'
import { StatusBanner } from '../components/StatusBanner'
import type { ScanArtifact, SbomArtifact, SecurityEnvelope } from '../types'

function severityClass(sev: string | undefined): string {
  const s = (sev || '').toLowerCase()
  if (s === 'critical') return 'sev critical'
  if (s === 'high') return 'sev high'
  if (s === 'medium') return 'sev medium'
  if (s === 'low') return 'sev low'
  return 'sev'
}

export function SecurityPage() {
  const [sbom, setSbom] = useState<SecurityEnvelope | null>(null)
  const [scan, setScan] = useState<SecurityEnvelope | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const [s, sc] = await Promise.all([
          apiGet<SecurityEnvelope>('/api/security/sbom'),
          apiGet<SecurityEnvelope>('/api/security/scan-report'),
        ])
        if (!cancelled) {
          setSbom(s)
          setScan(sc)
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

  const sbomArt = sbom?.artifact as SbomArtifact | undefined
  const components = Array.isArray(sbomArt?.components) ? sbomArt!.components! : []
  const scanArt = scan?.artifact as ScanArtifact | undefined
  const summary = scanArt?.summary
  const vulns = Array.isArray(scanArt?.vulnerabilities) ? scanArt!.vulnerabilities! : []

  return (
    <div className="page">
      <header className="page-header">
        <h2>Security</h2>
        <p className="muted">SBOM and vulnerability scan artifacts from `/api/security/*`.</p>
      </header>

      <StatusBanner loading={loading} error={error} />

      {!loading && !error && (
        <>
          <section className="card">
            <h3>SBOM</h3>
            {!sbom ? (
              <p className="muted">No SBOM available.</p>
            ) : (
              <>
                <p className="meta-inline">
                  kind: <code>{sbom.kind}</code> · source: <code>{sbom.source}</code>
                  {sbomArt?.bomFormat ? (
                    <>
                      {' '}
                      · format: <code>{sbomArt.bomFormat}</code>
                    </>
                  ) : null}
                  {' '}
                  · components: <strong>{components.length}</strong>
                </p>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Version</th>
                        <th>Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {components.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="muted">
                            No components listed.
                          </td>
                        </tr>
                      ) : (
                        components.map((c, i) => (
                          <tr key={`${c.name}-${c.version}-${i}`}>
                            <td>{c.name ?? '—'}</td>
                            <td>{c.version ?? '—'}</td>
                            <td>{c.type ?? '—'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>

          <section className="card">
            <h3>Scan report</h3>
            {!scan ? (
              <p className="muted">No scan report available.</p>
            ) : (
              <>
                <p className="meta-inline">
                  kind: <code>{scan.kind}</code> · source: <code>{scan.source}</code>
                  {scanArt?.scanner?.name ? (
                    <>
                      {' '}
                      · scanner: <code>{scanArt.scanner.name}</code>
                    </>
                  ) : null}
                </p>
                <div className="sev-row">
                  {(['critical', 'high', 'medium', 'low'] as const).map((k) => (
                    <span key={k} className={`pill sev ${k}`}>
                      {k}: {summary?.[k] ?? 0}
                    </span>
                  ))}
                  <span className="pill badge">total: {summary?.total ?? vulns.length}</span>
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Severity</th>
                        <th>Package</th>
                        <th>Installed</th>
                        <th>Fixed</th>
                        <th>Title</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vulns.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="muted">
                            No vulnerabilities listed.
                          </td>
                        </tr>
                      ) : (
                        vulns.map((v, i) => (
                          <tr key={`${v.vulnerabilityID}-${i}`}>
                            <td>
                              <code>{v.vulnerabilityID ?? '—'}</code>
                            </td>
                            <td>
                              <span className={severityClass(v.severity)}>
                                {v.severity ?? '—'}
                              </span>
                            </td>
                            <td>{v.pkgName ?? '—'}</td>
                            <td>{v.installedVersion ?? '—'}</td>
                            <td>{v.fixedVersion || '—'}</td>
                            <td className="clamp">{v.title ?? '—'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  )
}
