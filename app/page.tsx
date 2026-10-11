/**
 * PAGE: / (app/page.tsx) - LANDING INTELIGENTE / DUAL
 * ------------------------------------------------------------------
 * Este es el archivo raíz del template vinku-connector-template.
 * Sirve para 2 cosas distintas dependiendo de las ENV VARS:
 *
 * 1. SI ES FÁBRICA (NO existe CLIENTE_NOMBRE en.env):
 * -> Muestra un botón que te manda a /admin para crear proyectos de clientes.
 *
 * 2. SI ES PROYECTO DE CLIENTE (SI existe CLIENTE_NOMBRE):
 * -> Es el Panel del Cliente final. Muestra el Conector Activo
 * (Clientify -> Siigo) y la URL del Webhook que debe pegar en Clientify.
 *
 * NOTA TÉCNICA: Tiene 'force-dynamic' para evitar el error de Vercel
 * "Static page generation timeout after 60s".
 */
export const dynamic = 'force-dynamic'
export const revalidate = 0

import Link from 'next/link'

function CopyButton({ text }: { text: string }) {
  // Componente cliente inline sin necesidad de otro archivo
  return (
    <button
      onClick={() => {
        if (typeof window!== 'undefined') {
          navigator.clipboard.writeText(text)
          alert('Copiado: ' + text)
        }
      }}
      className="bg-white text-black px-4 rounded-lg font-medium h-[44px]"
    >
      Copiar
    </button>
  )
}

export default function Home() {
  const nombreCliente = process.env.CLIENTE_NOMBRE
  const vercelUrl = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_VERCEL_URL || 'tu-proyecto.vercel.app'

  const isClientProject =!!nombreCliente
  const webhookUrl = `https://${vercelUrl}/api/webhook/clientify`

  // SI ES FÁBRICA -> muestra link a /admin en vez de hacer redirect (el redirect colgaba el build)
  if (!isClientProject) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-6 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Fábrica Vinku</h1>
          <Link href="/admin" className="bg-white text-black px-6 py-3 rounded-lg">Ir al Admin</Link>
        </div>
      </div>
    )
  }

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
            <CopyButton text={webhookUrl} />
          </div>
        </div>

        {/* PANEL DE EVENTOS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <h2 className="font-semibold mb-4">Oportunidades Ganadas (Eventos)</h2>
            <div className="text-sm text-zinc-500">
              Aquí irán los logs que lleguen por el webhook.
              Conecta <code>/api/webhook/clientify</code> GET para verlos.
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <h2 className="font-semibold mb-4">Facturas Generadas en Siigo</h2>
            <div className="text-sm text-zinc-500">
              Aquí muestras la respuesta de Siigo (id factura, estado).
            </div>
          </div>
        </div>

        <div className="text-xs text-zinc-600 pt-6">
          Project: {vercelUrl} • Cliente: {nombreCliente}
        </div>
      </div>
    </div>
  )
}
