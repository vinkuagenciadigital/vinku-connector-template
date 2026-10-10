'use client'
import { useState, useEffect } from 'react'

export default function AdminPanel() {
  const [clientifyKey, setClientifyKey] = useState('')
  const [status, setStatus] = useState('')
  const [logs, setLogs] = useState<any[]>([])
  const [webhookUrl, setWebhookUrl] = useState('')

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

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Vinku Connector - Panel</h1>
      <div className="bg-white p-5 rounded-xl border shadow">
        <h2 className="font-bold mb-3">1. Conexión Clientify</h2>
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
        <h2 className="font-bold">Logs</h2>
        <pre className="text-xs">{JSON.stringify(logs, null, 2)}</pre>
      </div>
    </div>
  )
}
