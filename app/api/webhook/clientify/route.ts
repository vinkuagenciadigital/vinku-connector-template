import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// =================================================================
// OBJETIVO 1: MEMORIA TEMPORAL PARA EL PANEL /admin
// Guardamos los últimos webhooks que llegan en memoria del servidor.
// Usamos global para que no se borre con cada deploy caliente de Vercel.
// En producción final esto se cambia a Vercel Redis (antes se llamaba KV).
// =================================================================
let memoryLogs: any[] = (global as any).memoryLogs || []
;(global as any).memoryLogs = memoryLogs

// =================================================================
// OBJETIVO 2: CONFIGURACIÓN BASE PARA HABLAR CON CLIENTIFY API
// Esta es la URL oficial de la API v1 de Clientify.
// Toda la comunicación extra que hagamos (buscar deal completo) sale de aquí.
// =================================================================
const CLIENTIFY_API = "https://api.clientify.net/v1/";

// =================================================================
// OBJETIVO 2.1: TABLA DIAN - Conversión de Dirección principal a código DIAN
// Clientify trae Ciudad en texto "Medellín", Siigo necesita "05001"
// =================================================================
function getDianCodes(ciudad: string, estado: string): { city_code: string, state_code: string } | null {
  const c = (ciudad || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  if (c.includes("bogota")) return { city_code: "11001", state_code: "11" }
  if (c.includes("medellin")) return { city_code: "05001", state_code: "05" }
  if (c.includes("cali")) return { city_code: "76001", state_code: "76" }
  if (c.includes("barranquilla")) return { city_code: "08001", state_code: "08" }
  if (c.includes("cartagena")) return { city_code: "13001", state_code: "13" }
  if (c.includes("bucaramanga")) return { city_code: "68001", state_code: "68" }
  if (c.includes("cucuta")) return { city_code: "54001", state_code: "54" }
  if (c.includes("pereira")) return { city_code: "66001", state_code: "66" }
  if (c.includes("santa marta")) return { city_code: "47001", state_code: "47" }
  return null
}

// =================================================================
// OBJETIVO 3: FUNCIÓN getFullDeal - OBTENCIÓN DE DATOS COMPLETOS
// Por qué existe: El webhook que dispara Clientify solo avisa "se movió la
// oportunidad X a Ganada" y trae 4 datos básicos (nombre, monto, email).
// Con eso NO se puede facturar en Siigo. Siigo necesita NIT, Ciudad DIAN,
// Dirección, SKU y Cantidad. Esos datos viven dentro de la ficha completa
// de la oportunidad en Clientify, en custom_fields y products.
// Qué hace esta función: Con el ID que nos dio el webhook, hace una segunda
// llamada a Clientify: GET /deals/{id}/ y trae la ficha COMPLETA.
// Es el código base para cualquier cliente Siigo.
// =================================================================
async function getFullDeal(apiKey: string, dealId: string) {
  const res = await fetch(`${CLIENTIFY_API}deals/${dealId}/`, {
    // Autenticación con tu API Key que está en Vercel ENV -> CLIENTIFY_API_KEY
    headers: { "Authorization": `Token ${apiKey}` }
  });
  // Si Clientify responde error (ej: ID no existe, API Key mala), no rompemos el webhook
  if (!res.ok) return null;
  return res.json();
}

// NUEVO - Para traer datos de Empresa y Contacto
async function getFullContact(apiKey: string, contactId: string) {
  const res = await fetch(`${CLIENTIFY_API}contacts/${contactId}/`, {
    headers: { "Authorization": `Token ${apiKey}` }
  });
  if (!res.ok) return null;
  return res.json();
}
async function getFullCompany(apiKey: string, companyId: string) {
  const res = await fetch(`${CLIENTIFY_API}companies/${companyId}/`, {
    headers: { "Authorization": `Token ${apiKey}` }
  });
  if (!res.ok) return null;
  return res.json();
}

// =================================================================
// OBJETIVO 4: FUNCIÓN getCustomValue - BUSCADOR DE CAMPOS PERSONALIZADOS
// Por qué existe: Los campos personalizados de Clientify vienen en una lista
// desordenada: custom_fields: [{field: "siigo_nit", value: "900..."}, {field: "siigo_cantidad", value: 2}]
// Necesitamos una forma fácil de buscar "dame el valor de siigo_nit".
// Qué hace: Recorre la lista y si encuentra el campo que le pides, devuelve su valor.
// Si no lo encuentra, devuelve null. Así sabemos qué nos falta para facturar
// al cliente Siigo.
// =================================================================
function getCustomValue(custom_fields: any[], name: string) {
  if (!custom_fields) return null;
  const f = custom_fields.find((c: any) => c.field === name || c.name === name);
  let v = f?.value || null;
  // Soporte para valores tipo "13 | 13 - CC" o "1 - Contado" -> extrae solo el número
  if (typeof v === 'string' && v.includes('|')) v = v.split('|')[0].trim()
  if (typeof v === 'string' && /^\d+\s*-/.test(v)) v = v.split('-')[0].trim()
  return v;
}

// =================================================================
// OBJETIVO 5: ENDPOINT POST - EL WEBHOOK PRINCIPAL QUE RECIBE CLIENTIFY
// Este es el corazón de la integración base Clientify -> Siigo.
// Es el template que usamos para cualquier cliente Siigo.
// Clientify está configurado para hacer POST a /api/webhook/clientify cada vez
// que una oportunidad se mueve a Ganada. Aquí la recibimos.
// =================================================================
export async function POST(req: NextRequest) {
  // 5.1 - Leemos el JSON que envía Clientify
  const body = await req.json()

  // 5.2 - Lo imprimimos en los logs de Vercel para debuggear en cualquier proyecto
  console.log('--- CLIENTIFY REAL PAYLOAD ---');
  console.log(JSON.stringify(body, null, 2));

  // ===== DEDUP FIX V2 - evita doble evento de Clientify =====
  const incomingId = String(body.id || body.data?.id || '')
  const now = Date.now()
  if (incomingId) {
    const dupe = memoryLogs.find((l: any) => {
      if (String(l.oportunidad_id)!== incomingId) return false
      const t = new Date(l.fecha).getTime()
      return!isNaN(t) && (now - t) < 120000
    })
    if (dupe) {
      console.log(`♻️ Duplicado ignorado para deal ${incomingId} (menos de 2 min)`)
      return NextResponse.json({ ok: true, duplicate: true, id: incomingId })
    }
  }
  // ===== FIN DEDUP FIX =====

  // 5.3 - Creamos una entrada resumida para el panel /admin
  // Usamos || porque el payload de prueba y el real vienen en formatos distintos
  // body.id vs body.data.id, body.contact.name vs body.data.contact_name
  const entry: any = {
    fecha: new Date().toISOString(),
    oportunidad_id: body.id || body.data?.id || 'test_'+Date.now(),
    contact: body.contact?.name || body.data?.contact_name || body.name || 'Contacto Test',
    valor: body.value || body.data?.amount || 0,
    estado: '✅ RECIBIDO - Simulación F1',
    payload: body // Guardamos todo el original por si se necesita revisar para el cliente Siigo
  }
  // Lo ponemos de primero en la lista de logs
  memoryLogs.unshift(entry)
  if (memoryLogs.length > 20) memoryLogs.pop()

  // =================================================================
  // OBJETIVO 6: ENRIQUECIMIENTO DE DATOS PARA FACTURACIÓN SIIGO
  // Por qué existe: Aquí unimos el Objetivo 3 y 4.
  // Ya tenemos el aviso del webhook, ahora vamos a buscar la ficha completa
  // y extraemos solo lo que cualquier cliente Siigo exige para crear una
  // factura electrónica válida ante la DIAN.
  // Qué hace:
  // 1. Verifica que tengamos API Key y un dealId válido
  // 2. Llama a getFullDeal para traer custom_fields y products
  // 3. Extrae nit, ciudad_dian, direccion, sku, cantidad
  // 4. Calcula qué campos faltan para facturar y si está listo para Siigo
  // 5. Guarda todo eso DENTRO del mismo entry para verlo en /admin
  // Nota: Está en try/catch para que si falla la búsqueda completa,
  // el webhook original NO se rompa. Sigue marcando ✅ RECIBIDO.
  // =================================================================
  try {
    const apiKey = process.env.CLIENTIFY_API_KEY;
    const dealId = body.data?.id || body.id;
    if (apiKey && dealId) {
      console.log(`🔍 Buscando datos completos para deal ${dealId}...`);
      const fullDeal = await getFullDeal(apiKey, dealId);

      if (fullDeal) {
        // NUEVA LÓGICA - Detectar si facturamos a Empresa o a Contacto
        let clienteData: any = null
        let esEmpresa = false
        if (fullDeal.company) {
          const companyId = typeof fullDeal.company === 'object'? fullDeal.company.id : fullDeal.company
          clienteData = await getFullCompany(apiKey, companyId)
          esEmpresa = true
        } else if (fullDeal.contact) {
          const contactId = typeof fullDeal.contact === 'object'? fullDeal.contact.id : fullDeal.contact
          clienteData = await getFullContact(apiKey, contactId)
        }

        // NUEVA LÓGICA - Usar Dirección principal (campo tipo maps)
        const mainAddr = clienteData?.main_address || clienteData?.address || {}
        const ciudadTxt = mainAddr.city || clienteData?.city || ''
        const estadoTxt = mainAddr.state || clienteData?.state || ''
        const direccionTxt = mainAddr.address || mainAddr.street || ''
        const dianCodes = getDianCodes(ciudadTxt, estadoTxt)

        // Armamos el objeto que cualquier cliente Siigo necesita para facturar
        const dataParaSiigo = {
          // NIT nativo: CONTACTOS.Número de Identificación Fiscal / EMPRESAS.ID fiscal
          nit: clienteData?.tax_id || clienteData?.nif || clienteData?.id_fiscal || getCustomValue(fullDeal.custom_fields, "siigo_nit") || null,
          tipo_doc_dian: getCustomValue(clienteData?.custom_fields, "siigo_tipo_doc_dian") || (esEmpresa? "31" : "13"),
          responsable_iva: getCustomValue(clienteData?.custom_fields, "siigo_responsable_iva") || null,
          razon_social: clienteData?.company_name || clienteData?.name || clienteData?.razon_social || entry.contact,
          // Dirección principal
          direccion: direccionTxt || getCustomValue(fullDeal.custom_fields, "siigo_direccion_fact") || null,
          ciudad_nombre: ciudadTxt,
          estado_nombre: estadoTxt,
          ciudad_dian: getCustomValue(clienteData?.custom_fields, "siigo_ciudad_dian") || dianCodes?.city_code || getCustomValue(fullDeal.custom_fields, "siigo_ciudad_dian") || null,
          email: clienteData?.email || clienteData?.emails?.[0] || null,
          telefono: clienteData?.phone || null,
          // SKU nativo de PRODUCTOS
          sku: fullDeal.products?.[0]?.sku || fullDeal.products?.[0]?.code || getCustomValue(fullDeal.custom_fields, "siigo_producto_sku") || null,
          cantidad: fullDeal.products?.[0]?.quantity || getCustomValue(fullDeal.custom_fields, "siigo_cantidad") || 1,
          precio: fullDeal.products?.[0]?.price || fullDeal.amount || entry.valor,
          forma_pago_dian: getCustomValue(fullDeal.custom_fields, "siigo_forma_pago_dian") || "1",
          // Debug
          productos_completos: fullDeal.products || [],
          custom_fields_encontrados: fullDeal.custom_fields || [],
          direccion_completa_obj: mainAddr,
          cliente_fuente: esEmpresa? 'EMPRESA' : 'CONTACTO'
        };

        // Guardamos el resultado del enriquecimiento en el mismo log
        (entry as any).datos_completos_siigo = dataParaSiigo;
        (entry as any).cliente_data_raw = clienteData

        // Lista de lo que falta para poder llamar a Siigo (validación DIAN)
        ;(entry as any).faltantes_para_facturar = [
         !dataParaSiigo.nit? "NIF/ID fiscal (Contacto/Empresa)" : null,
         !dataParaSiigo.tipo_doc_dian? "siigo_tipo_doc_dian (13,31,22,41)" : null,
         !dataParaSiigo.responsable_iva? "siigo_responsable_iva" : null,
         !dataParaSiigo.ciudad_dian? "Dirección principal > Ciudad (mapear a DIAN)" : null,
         !dataParaSiigo.sku? "PRODUCTOS.SKU" : null,
        ].filter(Boolean);

        // Bandera final: true si ya tenemos todo para facturar al cliente Siigo
        ;(entry as any).listo_para_siigo = (entry as any).faltantes_para_facturar.length === 0;

        console.log("📦 Datos para Siigo:", dataParaSiigo);
      }
    }
  } catch (e: any) {
    console.log("⚠️ No se pudo obtener datos completos (normal si no hay API Key):", e.message);
    // No rompe el webhook, solo loguea el error
  }

  // 5.4 - Respondemos a Clientify que todo OK (200). Si no respondemos 200, Clientify reintenta.
  return NextResponse.json({ ok: true, log: entry })
}

export async function GET() {
  const seen = new Set<string>()
  const deduped: any[] = []
  for (const log of memoryLogs) {
    const id = String(log.oportunidad_id)
    if (!seen.has(id)) {
      seen.add(id)
      deduped.push(log)
    }
  }

  return NextResponse.json({
    ok: true,
    status: 'webhook_activo',
    cliente: process.env.CLIENTE_NOMBRE || 'test',
    eventos: deduped.slice(0,20)
  })
}
