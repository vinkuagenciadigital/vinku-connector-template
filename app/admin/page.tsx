// ============================================================================
// PARA QUÉ SIRVE EN TODO EL PROYECTO:
//   Es la pantalla de la "Fábrica" de Vinku Connector.
//   Es la única pantalla que usa el administrador para crear clientes nuevos.
//   No crea nada por sí sola, solo muestra el formulario y le pide al
//   servidor que haga el trabajo.
//   Flujo completo:
//   1. El admin escribe los datos del cliente aquí.
//   2. Esta pantalla los manda a /api/admin/crear-proyecto.
//   3. Esa API crea el proyecto en Vercel y los campos en Clientify.
//   4. Esta pantalla muestra el resultado: URL, webhook y campos.
// ============================================================================
'use client'
import { useState } from 'react'
import CopyButton from '../components/CopyButton'

export default function AdminPanel() {
  // Estado del formulario. Guarda lo que el admin escribe en los 5 inputs.
  // nombreCliente: nombre bonito del cliente, ej: Acme SAS
  // slug: parte de la URL, ej: acme-sas. Se limpia en el onChange.
  // clientifyApiKey: API Key de la cuenta de Clientify DEL CLIENTE, no de la Fábrica.
  // siigoUser / siigoAccessKey: credenciales de Siigo DEL CLIENTE.
  const [form, setForm] = useState({ nombreCliente: '', slug: '', clientifyApiKey: '', siigoUser: '', siigoAccessKey: '' })

  // Estado para saber si se está creando el proyecto.
  // Mientras es true, el botón se deshabilita y muestra "Creando proyecto...".
  // Sirve para que el admin no le dé clic dos veces.
  const [creando, setCreando] = useState(false)

  // Estado para guardar la respuesta que devuelve la API.
  // Si es null, no se muestra la tarjeta de resultado.
  // Si trae error, se muestra en rojo. Si trae éxito, se muestra URL, webhook y campos.
  const [resultado, setResultado] = useState<any>(null)

  // Función que se ejecuta al hacer clic en "CREAR PROYECTO CLIENTE"
  const crearProyecto = async () => {
    // Validación mínima: sin nombre y slug no se puede crear la URL del proyecto
    if(!form.slug || !form.nombreCliente) return alert('Falta nombre y slug')
    // Activa el estado de carga y limpia el resultado anterior
    setCreando(true)
    setResultado(null)
    try {
      // Llama a la API que crea el proyecto en Vercel y los campos en Clientify
      // Esta API está en: app/api/admin/crear-proyecto/route.ts
      const res = await fetch('/api/admin/crear-proyecto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      // Convierte la respuesta a JSON y la guarda en "resultado" para mostrarla abajo
      const data = await res.json()
      setResultado(data)
    } catch (e:any) {
      // Si falla la red o el servidor no responde, muestra el error
      setResultado({ error: e.message })
    }
    // Quita el estado de carga, el botón vuelve a estar activo
    setCreando(false)
  }

  // Clases reutilizables para no repetir estilos en cada input y tarjeta
  // inputClass: estilo de los campos del formulario, borde morado suave
  const inputClass = "w-full border border-[#8A6FE8]/20 rounded-lg p-3 text-sm bg-white text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-[#8A6FE8]/30"
  // cardClass: estilo de las tarjetas blancas, fondo blanco, borde morado y esquinas redondeadas
  const cardClass = "bg-white border border-[#8A6FE8]/20 rounded-2xl p-6 shadow-sm"

  return (
    // Fondo general morado claro de toda la pantalla, centrado
    <div className="min-h-screen bg-[#EDEBFE] text-black p-6 flex justify-center">
      {/* Contenedor central, máximo 3xl de ancho, con espacio entre secciones */}
      <div className="w-full max-w-3xl space-y-6">
        {/* Título de la Fábrica */}
        <div>
          <h1 className="text-3xl font-bold text-black">Vinku Connector - <span className="text-[#8A6FE8]">Fábrica</span></h1>
          <p className="text-sm text-black/60">Crea un nuevo proyecto de cliente en Vercel</p>
        </div>

        {/* Tarjeta del formulario para crear un cliente nuevo */}
        <div className={cardClass}>
          <h2 className="font-semibold mb-1 text-[#8A6FE8]">🏭 Crear Nuevo Cliente</h2>
          <p className="text-xs text-black/60 mb-5">Esto genera cliente.vercel.app con sus propias keys de Clientify y Siigo</p>
          
          {/* Inputs del formulario, en 2 columnas en pantalla grande */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Nombre del cliente */}
            <input placeholder="Nombre Cliente (Ej: Acme SAS)" className={inputClass} value={form.nombreCliente} onChange={e=>setForm({...form, nombreCliente: e.target.value})} />
            {/* Slug. Al escribir lo pasa a minúsculas y cambia cualquier caracter raro por guión */}
            <input placeholder="Slug (ej: acme-sas)" className={inputClass} value={form.slug} onChange={e=>setForm({...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'-')})} />
            {/* API Key de Clientify del cliente, ocupa las 2 columnas */}
            <input placeholder="Clientify API Key del Cliente" className={inputClass + " md:col-span-2"} value={form.clientifyApiKey} onChange={e=>setForm({...form, clientifyApiKey: e.target.value})} />
            {/* Usuario de Siigo del cliente */}
            <input placeholder="Siigo User del Cliente" className={inputClass} value={form.siigoUser} onChange={e=>setForm({...form, siigoUser: e.target.value})} />
            {/* Access Key de Siigo del cliente */}
            <input placeholder="Siigo Access Key del Cliente" className={inputClass} value={form.siigoAccessKey} onChange={e=>setForm({...form, siigoAccessKey: e.target.value})} />
          </div>

          {/* Botón para crear el proyecto. Llama a crearProyecto. Se deshabilita mientras crea. */}
          <button onClick={crearProyecto} disabled={creando} className="mt-5 w-full bg-[#8A6FE8] hover:bg-[#7a5fe0] text-white px-4 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50">
            {creando? 'Creando proyecto en Vercel...' : '🚀 CREAR PROYECTO CLIENTE'}
          </button>
        </div>

        {/* Tarjeta de resultado. Solo aparece si "resultado" ya tiene algo. */}
        {resultado && (
          <div className={cardClass + " border-green-200"}>
            {/* Si la API devolvió error, muestra el error completo en rojo */}
            {resultado.error ? (
              <pre className="p-3 bg-red-50 text-red-600 rounded-xl text-xs whitespace-pre-wrap border border-red-200">{JSON.stringify(resultado, null, 2)}</pre>
            ) : (
              // Si no hubo error, muestra el éxito con URL, webhook y campos
              <div className="space-y-4">
                {/* Etiqueta de éxito */}
                <div className="flex items-center gap-2">
                  <span className="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-1 rounded-full">✅ CREADO</span>
                  <p className="text-sm font-semibold text-black">Cliente creado satisfactoriamente</p>
                </div>
                
                {/* URL del proyecto nuevo del cliente, con botón para copiar */}
                <div>
                  <p className="text-xs text-black/60 mb-1">URL del Proyecto</p>
                  <div className="flex gap-2 items-center">
                    <code className="flex-1 bg-[#EDEBFE] p-3 rounded-lg text-sm break-all border border-[#8A6FE8]/20 text-black">{resultado.url}</code>
                    <CopyButton text={resultado.url} />
                  </div>
                </div>

                {/* Webhook que el admin debe pegar en Clientify para que Clientify avise al conector */}
                <div>
                  <p className="text-xs text-black/60 mb-1">Webhook para pegar en Clientify</p>
                  <div className="flex gap-2 items-center">
                    <code className="flex-1 bg-[#EDEBFE] p-3 rounded-lg text-sm break-all border border-[#8A6FE8]/30 text-black font-bold">{resultado.webhookUrl}</code>
                    <CopyButton text={resultado.webhookUrl} />
                  </div>
                </div>

                {/* Si la creación de campos en Clientify falló, muestra el error en rojo.
                    El proyecto en Vercel sí se creó, pero los campos no, por eso se avisa aparte. */}
                {resultado.camposError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-xs font-bold text-red-600">⚠️ Los campos fallaron:</p>
                    <p className="text-xs text-red-600 break-words">{resultado.camposError}</p>
                    <p className="text-xs text-red-500 mt-1">El proyecto en Vercel sí se creó, pero revisa la API Key de Clientify.</p>
                  </div>
                )}

                {/* Si los campos sí se crearon, muestra el resultado que devuelve lib/clientify-fields-v2.ts
                    Sirve para confirmar que los campos personalizados ya existen en la cuenta del cliente. */}
                {resultado.campos && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-xl">
                    <p className="text-xs font-bold text-green-700 mb-2">🧩 Campos en Clientify:</p>
                    <pre className="text-xs text-black/70 whitespace-pre-wrap break-words">{JSON.stringify(resultado.campos, null, 2)}</pre>
                  </div>
                )}

                {/* Link para abrir el panel del cliente recién creado */}
                <a href={resultado.url} target="_blank" className="inline-block text-sm text-[#8A6FE8] font-medium underline">Abrir panel del cliente →</a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
