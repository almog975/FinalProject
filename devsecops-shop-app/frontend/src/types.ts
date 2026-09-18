export type Product = {
  id: number
  name: string
  price: number
  stock: number
  description?: string | null
}

export type CartItem = {
  product_id: number
  quantity: number
  product?: Product
}

export type Cart = {
  user_id: string
  item_count: number
  items: CartItem[]
}

export type OrderItem = {
  product_id: number
  quantity: number
  unit_price: number
}

export type Order = {
  id: number
  user_id: string
  status: string
  total: number
  items: OrderItem[]
}

export type SecurityEnvelope = {
  source: string
  kind: string
  path?: string | null
  created_at?: string | null
  artifact: Record<string, unknown>
}

export type HealthStatus = {
  status: string
  error?: string
}

export type SbomArtifact = {
  bomFormat?: string
  specVersion?: string
  components?: Array<{
    name?: string
    version?: string
    type?: string
    purl?: string
  }>
}

export type ScanArtifact = {
  summary?: Record<string, number>
  vulnerabilities?: Array<{
    vulnerabilityID?: string
    pkgName?: string
    installedVersion?: string
    fixedVersion?: string
    severity?: string
    title?: string
  }>
  scanner?: { name?: string; version?: string }
  artifactName?: string
}
