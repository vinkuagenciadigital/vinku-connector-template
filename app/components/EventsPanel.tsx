'use client'
import { useEffect, useState } from 'react'

export default function EventsPanel() {
  const [eventos, setEventos] = useState<any[]>([])

  async function cargar() {
    try {
      const r = await fetch('/api/webhook/clientify', { cache: 'no-store' })
      const d = await r.json()
      setEventos(d.eventos || [])
    } catch {}
  }

  useEffect(() => {
    cargar()
    const i = setInterval(cargar, 3000)
    return () => clearInterval(i)
  }, [])

  if (eventos.length === 0) {
    return <div className="text-sm text-black/60">Sin eventos aún. Mueve una oportunidad a Ganada en Clientify.</div>
  }

  return (
    <div className="space-y-3 max-h-[500px] overflow-auto">
      {eventos.map((ev: any, idx: number) => (
        <div key={idx} className="border border-[#8A6FE8]/20 rounded-xl p-3 text-sm">
          <div className="font-semibold text-black">{ev.contact} - ${ev.valor}</div>
          <div className="text-xs text-black/50">{ev.fecha?.slice(0,19)} • ID: {ev.oportunidad_id}</div>
          <div className="text-xs mt-1">{ev.estado}</div>
          {ev.datos_completos_siigo && (
            <pre className="text-[10px] bg-[#EDEBFE] p-2 mt-2 rounded overflow-auto text-black">
              {JSON.stringify(ev.datos_completos_siigo, null, 2)}
            </pre>
          )}
          {ev.faltantes_para_facturar?.length > 0? (
            <div className="text-xs text-red-500 mt-1">Falta: {ev.faltantes_para_facturar.join(', ')}</div>
          ) : (
            <div className="text-xs text-green-600 mt-1">✅ Listo para Siigo</div>
          )}
        </div>
      ))}
    </div>
  )
}
