import { redirect } from 'next/navigation'

export default function Home() {
  const nombreCliente = process.env.CLIENTE_NOMBRE
  const isClientProject = !!nombreCliente

  // SI ES FÁBRICA (no tiene CLIENTE_NOMBRE) -> mándalo a /admin como ahora
  if (!isClientProject) {
    redirect('/admin')
  }

  // SI ES CLIENTE -> muestra su panel
  const webhookUrl = `https://${process.env.VERCEL_URL}/api/webhook/clientify`

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Conector Activo: {nombreCliente}</h1>
          <p className="text-zinc-400">Clientify → Siigo</p>
        </div>

        {/* WEBHOOK */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <h2 className="font-semibold mb-2">1. Webhook para Clientify</h2>
          <p className="text-sm text-zinc-400 mb-3">Pega esta URL en Clientify &gt; Automatizaciones &gt; Cuando oportunidad ganada &gt; Webhook</p>
          <div className="flex gap-2">
            <code className="flex-1 bg-black p-3 rounded-lg text-green-400 text-sm break-all border border-zinc-800">{webhookUrl}</code>
            <button onClick={() => navigator.clipboard.writeText(webhookUrl)} className="bg-white text-black px-4 rounded-lg font-medium">Copiar</button>
          </div>
        </div>

        {/* PANEL DE EVENTOS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <h2 className="font-semibold mb-4">Oportunidades Ganadas (Eventos)</h2>
            <div id="eventos" className="text-sm text-zinc-500">
              Aquí irán los logs que lleguen por el webhook. 
              Necesitas crear un <code>/api/logs</code> que lea de tu DB/KV.
            </div>
            {/* Para hacerlo real, crea un componente cliente que haga fetch a /api/events */}
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <h2 className="font-semibold mb-4">Facturas Generadas en Siigo</h2>
            <div className="text-sm text-zinc-500">
              Aquí muestras la respuesta de Siigo (id factura, estado).
            </div>
          </div>
        </div>

        <div className="text-xs text-zinc-600 pt-6">
          Project: {process.env.VERCEL_URL} • Cliente: {nombreCliente}
        </div>
      </div>
    </div>
  )
}
