'use client'
import { useState } from 'react'
import CopyButton from '../components/CopyButton'

export default function AdminPanel() {
  const [form, setForm] = useState({ nombreCliente: '', slug: '', clientifyApiKey: '', siigoUser: '', siigoAccessKey: '' })
  const [creando, setCreando] = useState(false)
  const [resultado, setResultado] = useState<any>(null)

  const crearProyecto = async () => {
    if(!form.slug || !form.nombreCliente) return alert('Falta nombre y slug')
    setCreando(true)
    setResultado(null)
    try {
      const res = await fetch('/api/admin/crear-proyecto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      setResultado(data)
    } catch (e:any) {
      setResultado({ error: e.message })
    }
    setCreando(false)
  }

  const inputClass = "w-full border border-[#8A6FE8]/20 rounded-lg p-3 text-sm bg-white text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-[#8A6FE8]/30"
  const cardClass = "bg-white border border-[#8A6FE8]/20 rounded-2xl p-6 shadow-sm"

  return (
    <div className="min-h-screen bg-[#EDEBFE] text-black p-6 flex justify-center">
      <div className="w-full max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-black">Vinku Connector - <span className="text-[#8A6FE8]">Fábrica</span></h1>
          <p className="text-sm text-black/60">Crea un nuevo proyecto de cliente en Vercel</p>
        </div>

        <div className={cardClass}>
          <h2 className="font-semibold mb-1 text-[#8A6FE8]">🏭 Crear Nuevo Cliente</h2>
          <p className="text-xs text-black/60 mb-5">Esto genera cliente.vercel.app con sus propias keys de Clientify y Siigo</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input placeholder="Nombre Cliente (Ej: Acme SAS)" className={inputClass} value={form.nombreCliente} onChange={e=>setForm({...form, nombreCliente: e.target.value})} />
            <input placeholder="Slug (ej: acme-sas)" className={inputClass} value={form.slug} onChange={e=>setForm({...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'-')})} />
            <input placeholder="Clientify API Key del Cliente" className={inputClass + " md:col-span-2"} value={form.clientifyApiKey} onChange={e=>setForm({...form, clientifyApiKey: e.target.value})} />
            <input placeholder="Siigo User del Cliente" className={inputClass} value={form.siigoUser} onChange={e=>setForm({...form, siigoUser: e.target.value})} />
            <input placeholder="Siigo Access Key del Cliente" className={inputClass} value={form.siigoAccessKey} onChange={e=>setForm({...form, siigoAccessKey: e.target.value})} />
          </div>

          <button onClick={crearProyecto} disabled={creando} className="mt-5 w-full bg-[#8A6FE8] hover:bg-[#7a5fe0] text-white px-4 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50">
            {creando? 'Creando proyecto en Vercel...' : '🚀 CREAR PROYECTO CLIENTE'}
          </button>
        </div>

        {resultado && (
          <div className={cardClass + " border-green-200"}>
            {resultado.error ? (
              <pre className="p-3 bg-red-50 text-red-600 rounded-xl text-xs whitespace-pre-wrap border border-red-200">{JSON.stringify(resultado, null, 2)}</pre>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-1 rounded-full">✅ CREADO</span>
                  <p className="text-sm font-semibold text-black">Cliente creado satisfactoriamente</p>
                </div>
                
                <div>
                  <p className="text-xs text-black/60 mb-1">URL del Proyecto</p>
                  <div className="flex gap-2 items-center">
                    <code className="flex-1 bg-[#EDEBFE] p-3 rounded-lg text-sm break-all border border-[#8A6FE8]/20 text-black">{resultado.url}</code>
                    <CopyButton text={resultado.url} />
                  </div>
                </div>

                <div>
                  <p className="text-xs text-black/60 mb-1">Webhook para pegar en Clientify</p>
                  <div className="flex gap-2 items-center">
                    <code className="flex-1 bg-[#EDEBFE] p-3 rounded-lg text-sm break-all border border-[#8A6FE8]/30 text-black font-bold">{resultado.webhookUrl}</code>
                    <CopyButton text={resultado.webhookUrl} />
                  </div>
                </div>

                <a href={resultado.url} target="_blank" className="inline-block text-sm text-[#8A6FE8] font-medium underline">Abrir panel del cliente →</a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
