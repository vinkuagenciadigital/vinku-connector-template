// =================================================================
// INVOICESDB - IDEMPOTENCIA CON POSTGRES (PASO 10)
// OBJETIVO: Evitar facturar 2 veces la misma oportunidad si Clientify
// reenvía el webhook de "Oportunidad Ganada".
// CÓMO LO EVITA: Guardamos 1 fila por oportunidad (opportunity_id).
// Antes de crear una factura, el route.ts pregunta: "¿este opportunity_id
// ya existe en Postgres?" Si existe, no crea otra factura.
// POR QUÉ POSTGRES Y NO MEMORIA: La memoria (memoryLogs / facturasStore)
// se borra con cada redeploy de Vercel. Postgres no, sobrevive a
// redeploys, reinicios y reenvíos horas después.
// =================================================================
import { Pool } from 'pg'

// =================================================================
// POOL - CONEXIÓN REUTILIZABLE A POSTGRES
// Por qué existe: Abrir una conexión nueva a Postgres por cada webhook
// es lento y puede agotar las conexiones. El Pool mantiene un conjunto
// de conexiones abiertas y las reutiliza.
// DATABASE_URL: Viene de Vercel ENV. Ej: postgres://user:pass@host:5432/db
// SSL: En local (localhost) no se usa SSL. En la nube (Neon / Supabase /
// Vercel Postgres) sí es obligatorio, por eso rejectUnauthorized: false.
// =================================================================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost')? false : { rejectUnauthorized: false },
})

// =================================================================
// ENSURETABLE - CREA LA TABLA SI NO EXISTE
// Por qué existe: Para no tener que crear la tabla a mano en SQL.
// Se ejecuta sola la primera vez que se usa getInvoiceByOpportunity()
// o saveInvoice().
// Qué crea:
// opportunity_id TEXT PRIMARY KEY -> El ID del deal en Clientify.
// Es PRIMARY KEY = UNIQUE por definición. Postgres mismo rechaza
// 2 filas con el mismo opportunity_id. Esta es la garantía real
// anti-duplicados, incluso si 2 webhooks llegan al mismo tiempo.
// invoice_id TEXT NOT NULL -> El número de factura creado (hoy MOCK-...,
// mañana el ID real de Siigo). Es lo que retornamos a Clientify.
// total NUMERIC -> Monto facturado, para auditoría.
// origen TEXT -> 'MOCK' o 'REAL', para saber de dónde salió.
// created_at TIMESTAMPTZ DEFAULT NOW() -> Fecha automática de guardado.
// IF NOT EXISTS: Si la tabla ya existe, no hace nada, no la borra.
// =================================================================
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoices (
      opportunity_id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      total NUMERIC,
      origen TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
}

// =================================================================
// GETINVOICEBYOPPORTUNITY - PREGUNTA "¿YA SE FACTURÓ ESTA OPORTUNIDAD?"
// Por qué existe: Es el chequeo de idempotencia. El route.ts lo llama
// ANTES de crear la factura.
// Qué hace: Busca 1 fila por opportunity_id.
// Qué devuelve:
// - Si existe -> La fila encontrada { opportunity_id, invoice_id,... }
// El route.ts ve que ya existe y NO crea otra factura.
// - Si no existe -> null. El route.ts sigue y crea la factura.
// $1: Es un parámetro de Postgres, no concatenamos el ID en el texto SQL.
// Así evitamos inyección SQL.
// try/catch: Si Postgres falla (sin DATABASE_URL, sin internet, etc.),
// no rompemos el webhook. Devuelve null y el route.ts sigue con el
// respaldo del campo nro_factura_siigo en Clientify.
// =================================================================
export async function getInvoiceByOpportunity(opportunityId: string) {
  try {
    await ensureTable()
    const res = await pool.query(
      'SELECT * FROM invoices WHERE opportunity_id = $1',
      [String(opportunityId)]
    )
    return res.rows[0] || null
  } catch (e: any) {
    console.log(`⚠️ Postgres getInvoice falló: ${e.message}`)
    return null
  }
}

// =================================================================
// SAVEINVOICE - GUARDA LA FACTURA CREADA EN POSTGRES
// Por qué existe: Es el registro que hace que el próximo webhook
// duplicado se bloquee. El route.ts lo llama JUSTO DESPUÉS de crear
// la factura (addFactura) y ANTES de retornar a Clientify.
// Qué hace: Inserta 1 fila con opportunity_id + invoice_id + total + origen.
// ON CONFLICT (opportunity_id) DO NOTHING: Es la protección contra
// carrera. Si 2 webhooks llegaron al mismo tiempo y los 2 intentan
// guardar el mismo opportunity_id, el primero gana y el segundo
// no hace nada (no da error, no duplica, no pisa la fila original).
// Qué devuelve:
// - true si guardó (o si ya existía y no hizo nada)
// - false si Postgres falló. No rompe el webhook, solo deja el log.
// =================================================================
export async function saveInvoice(opportunityId: string, invoiceId: string, total: number, origen: string) {
  try {
    await ensureTable()
    await pool.query(
      `INSERT INTO invoices (opportunity_id, invoice_id, total, origen)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (opportunity_id) DO NOTHING`,
      [String(opportunityId), String(invoiceId), total, origen]
    )
    return true
  } catch (e: any) {
    console.log(`⚠️ Postgres saveInvoice falló: ${e.message}`)
    return false
  }
}
