// Store en memoria para facturas generadas (mock o reales)
// Igual que memoryLogs de Clientify pero para Siigo

export type FacturaSiigo = {
  id: string
  fecha: string
  oportunidad_id: string
  razon_social: string
  nit: string | null
  total: number
  estado: string
  origen: 'MOCK' | 'REAL'
  data: any // lo que devuelve Siigo
  cliente_fuente: string
}

declare global {
  var __facturas__: FacturaSiigo[] | undefined
}

if (!globalThis.__facturas__) {
  globalThis.__facturas__ = []
}

export function addFactura(f: FacturaSiigo) {
  // para que no se duplique si pruebas 2 veces la misma oportunidad
  let facturas = globalThis.__facturas__!
  facturas = facturas.filter(x => x.oportunidad_id!== f.oportunidad_id)
  facturas.unshift(f)
  if (facturas.length > 20) facturas.pop()
  globalThis.__facturas__ = facturas
}

export function getFacturas() {
  return globalThis.__facturas__!
}
