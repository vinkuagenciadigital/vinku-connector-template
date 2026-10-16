// =================================================================
// FACTURASSTORE - ALMACÉN DE FACTURAS GENERADAS EN SIIGO
// =================================================================
// OBJETIVO: Guardar un historial de las facturas que ya creamos,
// para mostrarlas en el panel /admin en "Facturas Generadas en Siigo"
// y para evitar facturar 2 veces la misma oportunidad.
//
// Por qué existe: Si Clientify reenvía el webhook 2 veces (cosa que
// pasa seguido), sin este store no tendríamos forma de saber que esa
// oportunidad ya fue facturada y crearíamos una factura duplicada.
//
// Por qué es en memoria: Es la versión temporal, igual que memoryLogs
// de Clientify. Funciona para pruebas. En producción final esto se
// cambia a Postgres (Fase 10), porque en Vercel la memoria se borra
// en cada deploy / reinicio del servidor.
// =================================================================

// =================================================================
// TIPO FacturaSiigo - LA FORMA DE UNA FACTURA GUARDADA
// Define qué datos guardamos de cada factura. Es el contrato que
// usan el resto de archivos (siigoService, /admin, /api/test/siigo).
// =================================================================
export type FacturaSiigo = {
  id: string // ID interno que nos devuelve Siigo al crear la factura (invoice_id)
  fecha: string // Fecha y hora en que se creó la factura (ISO)
  oportunidad_id: string // ID de la oportunidad en Clientify que originó esta factura. CLAVE para idempotencia.
  razon_social: string // Nombre del cliente al que se facturó (empresa o persona)
  nit: string | null // NIT / documento del cliente facturado. Puede ser null si no vino.
  total: number // Valor total facturado
  estado: string // Estado de la factura en Siigo (ej: "CREADA", "MOCK", "ERROR")
  origen: 'MOCK' | 'REAL' // MOCK = factura simulada para pruebas sin llamar a Siigo real. REAL = factura creada de verdad en Siigo.
  data: any // Respuesta completa que devolvió Siigo (o el mock). Se guarda para debug y para mostrar detalle en /admin.
  cliente_fuente: string // Si se facturó a EMPRESA o a PERSONA. Viene de la decisión siigo_facturar_a.
}

// =================================================================
// VARIABLE GLOBAL - DONDE VIVEN LAS FACTURAS EN MEMORIA
// =================================================================
// Usamos globalThis para que el array no se borre con cada request
// en caliente de Next.js / Vercel. Es el mismo truco que usamos
// con __eventosClientify__ para los webhooks.
// Sin esto, cada vez que llegara un request, el array volvería a [].
declare global {
  var __facturas__: FacturaSiigo[] | undefined
}

// Si todavía no existe el array global, lo creamos vacío.
// Solo pasa la primera vez que el servidor arranca.
if (!globalThis.__facturas__) {
  globalThis.__facturas__ = []
}

// =================================================================
// FUNCIÓN addFactura - GUARDAR UNA FACTURA NUEVA
// Qué hace: Recibe una factura ya creada y la mete de primera en la lista.
// Por qué filtra antes: Para que no se duplique si pruebas 2 veces
// la misma oportunidad. Si ya había una factura con ese mismo
// oportunidad_id, la borra y deja solo la nueva (la más reciente).
// Por qué unshift: Para que la factura más nueva quede de primera
// y el panel /admin muestre primero lo último.
// Por qué el límite de 20: Para que la memoria no crezca sin control.
// Si hay más de 20 facturas, borra la más vieja (pop).
// =================================================================
export function addFactura(f: FacturaSiigo) {
  // para que no se duplique si pruebas 2 veces la misma oportunidad
  let facturas = globalThis.__facturas__!
  facturas = facturas.filter(x => x.oportunidad_id!== f.oportunidad_id)
  facturas.unshift(f)
  if (facturas.length > 20) facturas.pop()
  globalThis.__facturas__ = facturas
}

// =================================================================
// FUNCIÓN getFacturas - LEER TODAS LAS FACTURAS GUARDADAS
// Qué hace: Devuelve el array completo de facturas.
// Quién la usa: El panel /admin para mostrar la columna
// "Facturas Generadas en Siigo".
// =================================================================
export function getFacturas() {
  return globalThis.__facturas__!
}
