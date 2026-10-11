'use client'
import { useState, useEffect } from 'react'
import CopyButton from '../components/CopyButton'

export default function AdminPanel() {
  const [clientifyKey, setClientifyKey] = useState('')
  const [status, setStatus] = useState('')
  const [logs, setLogs] = useState<any[]>([])
  const [webhookUrl, setWebhookUrl] = useState('')

  // Fábrica
  const [form, setForm] = useState({ nombreCliente: '', slug: '', clientifyApiKey: '', siigoUser: '', siigoAccessKey: '' })
  const [creando, setCreando] = useState(false)
  const [resultado, setResultado] = useState<any>(null)

  useEffect(()=>{
    fetchLogs()
  },[])

  const fetchLogs = async () => {
    const r = await fetch('/api/logs')
    const j = await r.json()
    setLogs(j.logs || [])
  }

  const testClientify = async () => {
    setStatus('Probando Clientify...')
    const res = await fetch('/api/test-clientify', { method: 'POST', body: JSON.stringify({ key: clientifyKey }) })
    const data = await res.json()
    setStatus(JSON.stringify(data, null, 2))
  }

  const simulateWin = async () => {
    setStatus('Simulando oportunidad ganada...')
    const res = await fetch('/api/webhook/clientify', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        id: 'opp_test_'+Date.now(),
        name: 'Oportunidad Test',
        value: 1500000,
        contact: { name: 'Juan Perez', email: 'juan@test.com' }
      })
    })
    const data = await res.json()
    setStatus('✅ Simulación OK: '+JSON.stringify(data,null,2))
    fetchLogs()
  }

  const crearProyecto = async () => {
    if(!form.slug ||!form.nombreCliente) return alert('Falta nombre y slug')
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
      if(data.webhookUrl){
        setWebhookUrl(data.webhookUrl)
      }
    } catch (e:any) {
      setResultado({ error: e.message })
    }
    setCreando(false)
  }

  const inputClass = "w-full border border-[#8A6FE8]/20 rounded-lg p-3 text-sm bg-white text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-[#8A6FE8]/30"
  const cardClass = "bg-white border border-[#8A6FE8]/20 rounded-2xl p-5 shadow-sm"

  return (
    <div className="min-h-screen bg-[#EDEBFE] text-black p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-black">Vinku Connector - <span className="text-[#8A6FE8]">Panel</span></h1>
          <p className="text-sm text-black/60">Fábrica de conectores Clientify → Siigo</p>
        </div>

        {/* 0. FÁBRICA */}
        <div className={cardClass + " ring-1 ring-[#8A6FE8]/20"}>
          <h2 className="font-semibold mb-1 text-[#8A6FE8]">🏭 0. Fábrica - Crear Nuevo Cliente</h2>
          <p className="text-xs text-black/60 mb-4">Esto crea un nuevo proyecto Vercel: cliente.vercel.app con sus propias keys</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input placeholder="Nombre Cliente (Ej: Acme SAS)" className={inputClass} value={form.nombreCliente} onChange={e=>setForm({...form, nombreCliente: e.target.value})} />
            <input placeholder="Slug (ej: acme-sas)" className={inputClass} value={form.slug} onChange={e=>setForm({...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'-')})} />
            <input placeholder="Clientify API Key del Cliente" className={inputClass + " md:col-span-2"} value={form.clientifyApiKey} onChange={e=>setForm({...form, clientifyApiKey: e.target.value})} />
            <input placeholder="Siigo User del Cliente" className={inputClass} value={form.siigoUser} onChange={e=>setForm({...form, siigoUser: e.target.value})} />
            <input placeholder="Siigo Access Key del Cliente" className={inputClass} value={form.siigoAccessKey} onChange={e=>setForm({...form, siigoAccessKey: e.target.value})} />
          </div>

          <button onClick={crearProyecto} disabled={creando} className="mt-4 w-full bg-[#8A6FE8] hover:bg-[#7a5fe0] text-white px-4 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50">
            {creando? 'Creando proyecto en Vercel...' : '🚀 CREAR PROYECTO CLIENTE'}
          </button>

          {resultado && (
            <div className="mt-4">
              {resultado.url ? (
                <div className="bg-[#EDEBFE] border border-[#8A6FE8]/30 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-black">✅ Proyecto creado</p>
                  <div className="flex gap-2 items-center">
                    <code className="flex-1 bg-white p-2.5 rounded-lg text-sm break-all border border-[#8A6FE8]/20 text-black">{resultado.url}</code>
                    <CopyButton text={resultado.url} />
                  </div>
                  <div className="flex gap-2 items-center">
                    <code className="flex-1 bg-white p-2.5 rounded-lg text-sm break-all border border-green-200 text-black font-bold">{resultado.webhookUrl}</code>
                    <CopyButton text={resultado.webhookUrl} />
                  </div>
                  <a href={resultado.url} target="_blank" className="text-xs text-[#8A6FE8] underline">Abrir panel del cliente →</a>
                </div>
              ) : (
                <pre className="mt-3 p-3 bg-black text-green-400 rounded-xl text-xs whitespace-pre-wrap">{JSON.stringify(resultado, null, 2)}</pre>
              )}
            </div>
          )}
        </div>

        {webhookUrl && (
          <div className={cardClass + " border-green-200 bg-green-50/50"}>
            <h2 className="font-semibold mb-3 text-black">2. Webhook generado para <span className="text-[#8A6FE8]">{form.nombreCliente || 'este cliente'}</span></h2>
            <div className="flex gap-2">
              <div className="flex-1 bg-slate-900 text-green-400 p-3 rounded-lg text-xs break-all font-mono">{webhookUrl}</div>
              <CopyButton text={webhookUrl} />
            </div>
            <p className="text-xs text-black/60 mt-2">Pega esta URL en Clientify de {form.nombreCliente}</p>
            <button onClick={simulateWin} className="mt-3 w-full bg-black text-white py-3 rounded-lg font-medium hover:bg-zinc-800 transition-colors">🚀 Simular Ganada</button>
          </div>
        )}

        <div className={cardClass}>
          <h2 className="font-semibold mb-3 text-black">1. Conexión Clientify (de esta fábrica)</h2>
          <input value={clientifyKey} onChange={e=>setClientifyKey(e.target.value)} placeholder="API Key Clientify" className={inputClass} />
          <button onClick={testClientify} className="mt-3 bg-black text-white px-4 py-2.5 rounded-lg w-full font-medium hover:bg-zinc-800 transition-colors">Probar Clientify</button>
        </div>

        <div className={cardClass}>
          <h2 className="font-semibold mb-3 text-black">3. Siigo (Fase 1 Simulación)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input placeholder="Usuario Siigo" className={inputClass} />
            <input placeholder="Access Key" className={inputClass} />
            <input placeholder="Partner ID" defaultValue="Vinku" className={inputClass} />
          </div>
        </div>

        {status && <pre className="bg-black text-white p-4 rounded-2xl text-xs overflow-auto border border-zinc-800">{status}</pre>}
        
        <div className={cardClass}>
          <h2 className="font-semibold mb-3 text-black">Logs de esta fábrica</h2>
          <pre className="text-xs overflow-auto max-h-96 bg-[#EDEBFE] p-3 rounded-lg border border-[#8A6FE8]/20">{JSON.stringify(logs, null, 2)}</pre>
        </div>
      </div>
    </div>
  )
}
