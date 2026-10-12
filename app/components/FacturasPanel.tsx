'use client'
import { useEffect, useState, useRef } from 'react'

export default function FacturasPanel() {
  const [facturas, setFacturas] = useState<any[]>([])
  // FIX VERCEL MULTI-LAMBDA: acumulativo para que no alterne como pasaba en eventos
  const mapaRef = useRef<Map<string, any>>(new Map())
  const [abierto, setAbierto] = useState<number | null>(0)

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
      {facturas.map((f: any, idx: number) => {
        const isOpen = abierto === idx
        const data = f.data || {}
        const productos = data.productos || []
        return (
        <div key={f.oportunidad_id} className="border border-[#8A6FE8]/20 rounded-xl text-sm bg-white overflow-hidden">
          <div className="p-3 cursor-pointer hover:bg-[#F8F7FF]/30 transition" onClick={()=> setAbierto(isOpen? null : idx)}>
            <div className="flex justify-between items-start gap-2">
              <div>
                <div className="font-semibold text-black text-[13px] flex items-center gap-2">
                  <span className="text-black/30 text-[10px]">{isOpen? '▼' : '▶'}</span>
                  {f.razon_social} - ${Number(f.total||0).toLocaleString()}
                </div>
                <div className="text-xs text-black/50 ml-4">{f.fecha?.slice(0,19)} • Oport: {f.oportunidad_id}</div>
              </div>
              <span className={`text-[10px] px-2 py-1 rounded-full font-bold whitespace-nowrap border ${f.origen==='MOCK'? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'bg-green-100 text-green-700 border-green-200'}`}>
                {f.origen} • {f.estado}
              </span>
            </div>
            <div className="text-[11px] mt-2 text-black/60 ml-4">
              ✅ RECIBIDO • Factura a: <b className="text-black">{f.cliente_fuente}</b>
            </div>
          </div>

          {isOpen && (
            <div className="px-3 pb-3">
              <div className="mt-1 bg-[#F8F7FF] border border-[#8A6FE8]/10 rounded-lg p-3 space-y-2.5 text-[11px]">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-black/40">ID Factura Siigo</p>
                  <p className="font-bold text-black text-[12px]">{f.id}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-black/40">NIT / Documento</p>
                    <p className="font-semibold text-black">{data.nit || f.nit || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-black/40">Ciudad DIAN</p>
                    <p className="font-semibold text-black">{data.ciudadDian || '—'}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-black/40">Dirección</p>
                  <p className="text-black leading-snug">{data.direccion || '—'}</p>
                </div>
                <div className="text-black/60 space-y-0.5">
                  <p>📧 {data.clientEmail || '—'}</p>
                  <p>👤 {data.clientName || f.razon_social}</p>
                </div>
                <div className="pt-2 border-t border-[#8A6FE8]/10 space-y-2">
                  {productos.length > 0? productos.map((prod: any, pIdx: number) => (
                    <div key={pIdx} className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-[13px] font-bold text-black leading-tight line-clamp-2">{prod.description || prod.name || 'Producto'}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="bg-white border border-[#8A6FE8]/20 px-2 py-1 rounded font-mono font-bold text-[11px]">{prod.id || prod.product_id}</span>
                          <span className="text-black/60 text-[11px]">x{prod.quantity || 1}</span>
                        </div>
                      </div>
                      <span className="font-bold text-black text-[12px]">${Number(prod.price || 0).toLocaleString()}</span>
                    </div>
                  )) : (
                    <div className="bg-white border rounded-lg p-2 text-[10px]">
                      <pre className="whitespace-pre-wrap break-all text-black/70">{JSON.stringify(data, null, 2)}</pre>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-dashed border-[#8A6FE8]/20">
                    <span className="text-[10px] uppercase tracking-wide text-black/50 font-bold">Total factura</span>
                    <span className="font-bold text-black text-[13px]">${Number(f.total || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        )
      })}
    </div>
  )
}
