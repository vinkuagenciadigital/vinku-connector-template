import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
})

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
