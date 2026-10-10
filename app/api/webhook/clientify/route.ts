import { NextRequest, NextResponse } from 'next/server'
let memoryLogs: any[] = (global as any).memoryLogs || []
;(global as any).memoryLogs = memoryLogs

export async function POST(req: NextRequest) {
  const body = await req.json()
  const entry = {
    fecha: new Date().toISOString(),
    oportunidad_id: body.id || 'test_'+Date.now(),
    contact: body.contact?.name || body.name || 'Contacto Test',
    valor: body.value || 0,
    estado: '✅ RECIBIDO - Simulación F1',
    payload: body
  }
  memoryLogs.unshift(entry)
  return NextResponse.json({ ok: true, log: entry })
}
export async function GET(){
  return NextResponse.json({ ok: true, message: 'Webhook activo. Usa POST.' })
}
