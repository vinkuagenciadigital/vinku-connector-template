'use client'
import { useEffect, useState, useRef } from 'react'

export default function EventsPanel() {
  const [eventos, setEventos] = useState<any[]>([])
  // NUEVO: Estado para saber qué tablero está abierto (null = todos cerrados, 0 = primero abierto)
  const [abierto, setAbierto] = useState<number | null>(0)
  // FIX PARPADEO: guarda lo último bueno
  const cache = useRef<any[]>([])

  async function cargar() {
    try {
      const r = await fetch('/api/webhook/clientify', { cache: 'no-store' })
      const d = await r.json()
      const nuevos = d.eventos || []
      // FIX PARPADEO: si Vercel responde vacío, no borres lo que ya tenías
      if (nuevos.length > 0) {
        cache.current = nuevos
        setEventos(nuevos)
      } else if (cache.current.length > 0) {
        setEventos(cache.current)
      } else {
        setEventos(nuevos)
      }
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
    <div className="space-y-3 max-h-[500px] overflow-auto pr-1">
      {eventos.map((ev: any, idx: number) => {
        const s = ev.datos_completos_siigo
        const listo = ev.listo_para_siigo
        // FIX NOMBRE PRODUCTO - obtener nombre real
        const nombreProducto = s?.producto_nombre || s?.productos_completos?.[0]?.name || s?.productos_completos?.[0]?.product_name || null
        const estadoLimpio = (ev.estado || '').replace(' - Simulación F1','').replace('Simulación F1','').trim()
        // FIX MULTI-PRODUCTO - total real
        const totalReal = s?.precio_total_oportunidad || ev.valor
        // NUEVO: verifica si este tablero está abierto
        const isOpen = abierto === idx

        return (
          <div key={idx} className="border border-[#8A6FE8]/20 rounded-xl text-sm bg-white overflow-hidden">
            {/* Header - AHORA CLICKEABLE PARA DESPLEGAR */}
            <div
              className="p-3 cursor-pointer hover:bg-[#F8F7FF]/30 transition"
              onClick={()=> setAbierto(isOpen? null : idx)}
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  {/* FIX NOMBRE PRODUCTO - nombre + flechita de despliegue */}
                  <div className="font-semibold text-black text-[13px] flex items-center gap-2">
                    <span className="text-black/30 text-[10px]">{isOpen? '▼' : '▶'}</span>
                    {s?.razon_social || ev.contact} - ${Number(totalReal || 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-black/50 ml-4">{ev.fecha?.slice(0,19)} • ID: {ev.oportunidad_id}</div>
                </div>
                <span className={`text-[10px] px-2 py-1 rounded-full font-bold whitespace-nowrap border ${listo? 'bg-green-100 text-green-700 border-green-200' : 'bg-yellow-100 text-yellow-700 border-yellow-200'}`}>
                  {listo? '✅ LISTO' : '⚠️ FALTA'}
                </span>
              </div>

              <div className="text-[11px] mt-2 text-black/60 ml-4">
                {estadoLimpio} • Factura a: <b className="text-black">{s?.cliente_fuente || '—'}</b>
              </div>
            </div>

            {/* TABLERO - SOLO SE MUESTRA SI isOpen ES TRUE */}
            {isOpen && (
              <div className="px-3 pb-3">
                {/* NUEVO - Información descriptiva en lugar de código */}
                {s && (
                  <div className="mt-1 bg-[#F8F7FF] border border-[#8A6FE8]/10 rounded-lg p-3 space-y-2.5 text-[11px]">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-black/40">NIT / Documento</p>
                        <p className={`font-semibold ${!s.nit? 'text-red-500' : 'text-black'}`}>
                          {s.nit || '— sin NIT —'} <span className="text-black/40 font-normal">({s.tipo_doc_dian})</span>
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-black/40">Responsable IVA</p>
                        <p className="font-semibold text-black">{s.responsable_iva || '—'}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-black/40">Dirección DIAN</p>
                      <p className="text-black leading-snug">
                        {s.direccion || '— sin dirección —'}<br/>
                        <span className="text-black/60">{s.ciudad_nombre} {s.estado_nombre && `• ${s.estado_nombre}`} • Código: <b>{s.ciudad_dian || '—'}</b></span>
                      </p>
                    </div>

                    <div className="text-black/60 space-y-0.5">
                      <p>📧 {s.email || 'sin email'} </p>
                      <p>📞 {s.telefono || 'sin teléfono'}</p>
                    </div>

                    {/* FIX MULTI-PRODUCTO - ahora muestra TODOS los productos + total oportunidad */}
                    <div className="pt-2 border-t border-[#8A6FE8]/10 space-y-2">
                      {(s.productos_completos && s.productos_completos.length > 0)? (
                        s.productos_completos.map((prod: any, pIdx: number) => (
                          <div key={pIdx} className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="text-[13px] font-bold text-black leading-tight">{prod.name || prod.product_name || nombreProducto || 'Producto'}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="bg-white border border-[#8A6FE8]/20 px-2 py-1 rounded font-mono font-bold text-[11px]">{prod.sku || s.sku}</span>
                                <span className="text-black/60 text-[11px]">x{prod.quantity || 1}</span>
                              </div>
                            </div>
                            <span className="font-bold text-black text-[12px]">${Number(prod.price || 0).toLocaleString()}</span>
                          </div>
                        ))
                      ) : (
                        // Fallback si viene solo 1 producto en formato viejo
                        <>
                          {nombreProducto && (
                            <p className="text-[13px] font-bold text-black leading-tight mb-1">{nombreProducto}</p>
                          )}
                          <div className="flex items-center gap-2">
                            <span className="bg-white border border-[#8A6FE8]/20 px-2 py-1 rounded font-mono font-bold text-[11px]">{s.sku}</span>
                            <span className="text-black/60 text-[11px]">x{s.cantidad}</span>
                            <span className="ml-auto font-bold text-black">${Number(s.precio || 0).toLocaleString()}</span>
                          </div>
                        </>
                      )}
                      {/* Total */}
                      <div className="flex items-center justify-between pt-2 border-t border-dashed border-[#8A6FE8]/20">
                        <span className="text-[10px] uppercase tracking-wide text-black/50 font-bold">Total oportunidad</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-black text-[13px]">${Number(totalReal || 0).toLocaleString()}</span>
                          <span className="text-[10px] text-black/40">Pago: {s.forma_pago_dian}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Faltantes / Listo */}
                {ev.faltantes_para_facturar?.length > 0? (
                  <div className="text-xs text-red-600 mt-2 bg-red-50 border border-red-200 rounded-lg p-2">
                    <b className="text-[10px] uppercase">Falta para Siigo:</b> {ev.faltantes_para_facturar.join(', ')}
                  </div>
                ) : (
                  <div className="text-xs text-green-600 mt-2 bg-green-50 border border-green-200 rounded-lg p-2 font-semibold">✅ Listo para Siigo</div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
