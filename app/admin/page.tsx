'use client'
import { useState, useEffect } from 'react'

export default function AdminPanel() {
  const [clientifyKey, setClientifyKey] = useState('')
  const [status, setStatus] = useState('')
  const [logs, setLogs] = useState<any[]>([])
  const [webhookUrl, setWebhookUrl] = useState('')

  // NUEVO: Fábrica
  const [form, setForm] = useState({ nombreCliente: '', slug: '', clientifyApiKey: '', siigoUser: '', siigoAccessKey: '' })
  const [creando, setCreando] = useState(false)
  const [resultado, setResultado] = useState<any>(null)

  useEffect(()=>{
    setWebhookUrl(`${window.location.origin}/api/webhook/clientify`)
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
    } catch (e:any) {
      setResultado({ error: e.message })
    }
    setCreando(false)
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6 bg-zinc-50 min-h-screen">
      <h1 className="text-3xl font-bold">Vinku Connector - Panel</h1>

      {/* === NUEVO BLOQUE FABRICA === */}
      <div className="bg-gradient-to-br from-violet-600 to-indigo-700 p-[1px] rounded-xl">
        <div className="bg-white p-5 rounded-xl">
          <h2 className="font-bold mb-1 text-violet-700">🏭 0. Fábrica - Crear Nuevo Cliente</h2>
          <p className="text-xs text-zinc-500 mb-3">Esto crea un nuevo proyecto Vercel: cliente.vercel.app con sus propias keys</p>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Nombre Cliente (Ej: Acme SAS)" className="border p-2 rounded w-full" value={form.nombreCliente} onChange={e=>setForm({...form, nombreCliente: e.target.value})} />
            <input placeholder="Slug (ej: acme-sas)" className="border p-2 rounded w-full" value={form.slug} onChange={e=>setForm({...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'-')})} />
            <input placeholder="Clientify API Key del Cliente" className="border p-2 rounded col-span-2" value={form.clientifyApiKey} onChange={e=>setForm({...form, clientifyApiKey: e.target.value})} />
            <input placeholder="Siigo User del Cliente" className="border p-2 rounded" value={form.siigoUser} onChange={e=>setForm({...form, siigoUser: e.target.value})} />
            <input placeholder="Siigo Access Key del Cliente" className="border p-2 rounded" value={form.siigoAccessKey} onChange={e=>setForm({...form, siigoAccessKey: e.target.value})} />
          </div>
          <button onClick={crearProyecto} disabled={creando} className="mt-3 bg-violet-600 hover:bg-violet-700 text-white px-4 py-3 rounded-lg w-full font-bold">
            {creando? 'Creando proyecto en Vercel...' : '🚀 CREAR PROYECTO CLIENTE'}
          </button>
          {resultado && (
            <div className="mt-3 p-3 bg-black text-green-400 rounded text-xs">
              <pre className="whitespace-pre-wrap">{JSON.stringify(resultado, null, 2)}</pre>
              {resultado.url && <div className="mt-2 text-white">✅ <a href={resultado.url} target="_blank" className="underline text-violet-300">{resultado.url}</a> listo<br/>Webhook: {resultado.webhookUrl}</div>}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white p-5 rounded-xl border shadow">
        <h2 className="font-bold mb-3">1. Conexión Clientify (de esta fábrica)</h2>
        <input value={clientifyKey} onChange={e=>setClientifyKey(e.target.value)} placeholder="API Key Clientify" className="w-full border p-3 rounded-lg" />
        <button onClick={testClientify} className="mt-2 bg-indigo-600 text-white px-4 py-2 rounded-lg w-full">Probar Clientify</button>
      </div>
      <div className="bg-white p-5 rounded-xl border shadow">
        <h2 className="font-bold mb-3">2. Webhook para Clientify</h2>
        <div className="bg-slate-900 text-green-400 p-3 rounded text-xs break-all">{webhookUrl}</div>
        <button onClick={simulateWin} className="mt-3 w-full bg-slate-800 text-white py-3 rounded-lg">🚀 Simular Ganada</button>
      </div>
      <div className="bg-white p-5 rounded-xl border shadow">
        <h2 className="font-bold mb-3">3. Siigo (Fase 1 Simulación)</h2>
        <div className="grid grid-cols-3 gap-2">
          <input placeholder="Usuario Siigo" className="border p-2 rounded" />
          <input placeholder="Access Key" className="border p-2 rounded" />
          <input placeholder="Partner ID" defaultValue="Vinku" className="border p-2 rounded" />
        </div>
      </div>
      {status && <pre className="bg-black text-white p-4 rounded text-xs overflow-auto">{status}</pre>}
      <div className="bg-white p-5 rounded-xl border shadow">
        <h2 className="font-bold">Logs de esta fábrica</h2>
        <pre className="text-xs overflow-auto max-h-96">{JSON.stringify(logs, null, 2)}</pre>
      </div>
    </div>
  )
}
