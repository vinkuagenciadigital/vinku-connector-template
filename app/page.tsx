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
import CopyButton from './components/CopyButton'
import EventsPanel from './components/EventsPanel'

export default function Home() {
const nombreCliente = process.env.CLIENTE_NOMBRE
let rawUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || 'tu-proyecto.vercel.app'
rawUrl = rawUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
const vercelUrl = rawUrl.replace('.vercel.app', '') + '.vercel.app'

const isClientProject = !!nombreCliente

const webhookUrl = `https://${vercelUrl}/api/webhook/clientify`

  // SI ES FÁBRICA -> muestra link a /admin en vez de hacer redirect (el redirect colgaba el build)
  if (!isClientProject) {
    return (
      <div className="min-h-screen bg-[#EDEBFE] text-black p-6 flex items-center justify-center">
        <div className="text-center bg-white border border-[#8A6FE8]/20 rounded-2xl p-8 shadow-sm">
          <h1 className="text-2xl font-bold mb-4 text-black">Fábrica Vinku</h1>
          <Link href="/admin" className="inline-block bg-[#8A6FE8] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#7a5fe0] transition-colors">Ir al Admin</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#EDEBFE] text-black p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-black">Conector Activo: <span className="text-[#8A6FE8]">{nombreCliente}</span></h1>
          <p className="text-black/60">Clientify → Siigo</p>
        </div>

        {/* WEBHOOK */}
        <div className="bg-white border border-[#8A6FE8]/20 rounded-2xl p-5 shadow-sm">
          <h2 className="font-semibold mb-2 text-black">1. Webhook para Clientify</h2>
          <p className="text-sm text-black/60 mb-3">Pega esta URL en Clientify &gt; Ajustes &gt; Integraciones &gt; Integradores &gt; Webhooks &gt; Editar &gt;Webhook de oportunidad</p>
          <div className="flex gap-2">
            <code className="flex-1 bg-[#EDEBFE] p-3 rounded-lg text-black text-sm break-all border border-[#8A6FE8]/30">{webhookUrl}</code>
            <CopyButton text={webhookUrl} />
          </div>
        </div>

        {/* PANEL DE EVENTOS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-[#8A6FE8]/20 rounded-2xl p-5 shadow-sm">
            <h2 className="font-semibold mb-4 text-black">Oportunidades Ganadas (Eventos)</h2>
            <EventsPanel />
          </div>

          <div className="bg-white border border-[#8A6FE8]/20 rounded-2xl p-5 shadow-sm">
            <h2 className="font-semibold mb-4 text-black">Facturas Generadas en Siigo</h2>
            <div className="text-sm text-black/60">
              Aquí muestras la respuesta de Siigo (id factura, estado).
            </div>
          </div>
        </div>

          <div className="bg-white border border-[#8A6FE8]/20 rounded-2xl p-5 shadow-sm">
            <h2 className="font-semibold mb-4 text-black">Facturas Generadas en Siigo</h2>
            <div className="text-sm text-black/60">
              Aquí muestras la respuesta de Siigo (id factura, estado).
            </div>
          </div>
        </div>

        <div className="text-xs text-black/40 pt-6">
          Project: {vercelUrl} • Cliente: {nombreCliente}
        </div>
      </div>
    </div>
  )
}
