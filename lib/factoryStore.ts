// lib/factoryStore.ts - Persistencia para fábrica, evita intermitencia de globalThis
export async function guardarEvento(entry: any) {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY
  const cliente = process.env.CLIENTE_NOMBRE || 'test'
  if (!url || !key) return
  try {
    await fetch(`${url}/rest/v1/eventos_clientify`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ cliente, oportunidad_id: String(entry.oportunidad_id), data: entry })
    })
  } catch(e){ console.log('FactoryStore save error', e) }
}

export async function leerEventos() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY
  const cliente = process.env.CLIENTE_NOMBRE || 'test'
  if (!url || !key) return null
  try {
    const res = await fetch(`${url}/rest/v1/eventos_clientify?cliente=eq.${cliente}&order=created_at.desc&limit=20`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: 'no-store'
    })
    const rows = await res.json()
    if (Array.isArray(rows)) return rows.map((r:any) => r.data)
  } catch(e){}
  return null
}
