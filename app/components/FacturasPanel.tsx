'use client'
import { useEffect, useState, useRef } from 'react'

export default function FacturasPanel() {
  const [facturas, setFacturas] = useState<any[]>([])
  // FIX VERCEL MULTI-LAMBDA: acumulativo para que no alterne como pasaba en eventos
  const mapaRef = useRef<Map<string, any>>(new Map())

  async function cargar() {
    try {
      const r = await fetch('/api/facturas', { cache: 'no-store' })
      const d = await r.json()
      const nuevas = d.facturas || []
      if (nuevas.length === 0) return

      for (const f of nuevas) {
        mapaRef.current.set(String(f.oportunidad_id), f)
      }
      const combinado = Array.from(mapaRef.current.values())
      .sort((a,b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())

      setFacturas(combinado.slice(0,20))
    } catch {}
  }

  useEffect(() => {
    cargar()
    const i = setInterval(cargar, 15000)
    return () => clearInterval(i)
  }, [])

  if (facturas.length === 0) {
    return <div className="text-sm text-black/50">Aquí muestras la respuesta de Siigo (id factura, estado). <br/>Ejecuta /api/test/siigo para simular una.</div>
  }

  return (
    <div className="space-y-3 max-h-[600px] overflow-auto pr-1">
      {facturas.map((f: any, idx: number) => (
        <div key={f.oportunidad_id} className="border border-green-200 rounded-xl p-3 text-sm bg-green-50/50">
          <div className="flex justify-between items-start gap-2">
            <div>
              <div className="font-semibold text-black text-[13px]">{f.razon_social} - ${Number(f.total||0).toLocaleString()}</div>
              <div className="text-xs text-black/50">{f.fecha?.slice(0,19)} • Oport: {f.oportunidad_id}</div>
            </div>
            <span className={`text-[10px] px-2 py-1 rounded-full font-bold border ${f.origen==='MOCK'? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'bg-green-100 text-green-700 border-green-200'}`}>
              {f.origen} • {f.estado}
            </span>
          </div>
          <div className="mt-2 bg-white border rounded-lg p-2 text-[11px] font-mono">
            <p className="text-black/40 text-[10px] uppercase">ID Factura Siigo</p>
            <p className="font-bold text-black text-[12px]">{f.id}</p>
            <p className="mt-2 text-black/40 text-[10px] uppercase">Respuesta completa</p>
            <pre className="whitespace-pre-wrap break-all text-[10px] text-black/70">{JSON.stringify(f.data, null, 2)}</pre>
          </div>
        </div>
      ))}
    </div>
  )
}
