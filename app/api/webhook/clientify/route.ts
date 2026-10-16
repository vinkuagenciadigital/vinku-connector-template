import { NextRequest, NextResponse } from 'next/server'
import { checkEligibility } from '@/lib/eligibility'
import { crearNotaClientify } from '@/lib/clientifyNotes'
import { addFactura } from '@/lib/facturasStore'
import { enviarFacturaAClientify } from '@/lib/clientifyInvoiceReturn'
import { getInvoiceByOpportunity, saveInvoice } from '@/lib/invoicesDb'

export const dynamic = 'force-dynamic'

// =================================================================
// OBJETIVO 1: MEMORIA TEMPORAL PARA EL PANEL /admin
// Guardamos los últimos webhooks que llegan en memoria del servidor.
// Usamos global para que no se borre con cada deploy caliente de Vercel.
// En producción final esto se cambia a Vercel Redis (antes se llamaba KV).
// =================================================================
declare global {
  var __eventosClientify__: any[] | undefined
}

if (!globalThis.__eventosClientify__) {
  globalThis.__eventosClientify__ = (global as any).memoryLogs || []
}
let memoryLogs: any[] = globalThis.__eventosClientify__ || []
;(global as any).memoryLogs = memoryLogs
globalThis.__eventosClientify__ = memoryLogs

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

// FIX V5 - Extractor de ID desde URL tipo https://api.clientify.net/v1/contacts/168686864/
function extractId(input: any): string | null {
  if (!input) return null
  if (typeof input === 'number') return String(input)
  if (typeof input === 'string') {
    const match = input.match(/\/(\d+)\/?$/)
    if (match) return match[1]
    if (/^\d+$/.test(input.trim())) return input.trim()
    return null
  }
  if (typeof input === 'object') {
    if (input.id) return String(input.id)
    if (input.url) return extractId(input.url)
  }
  return null
}

// NUEVO - Para traer datos de Empresa y Contacto - COMPATIBLE V1/V2
async function getFullContact(apiKey: string, contactInput: any) {
  const contactId = extractId(contactInput)
  if (!contactId) {
    console.log('❌ No se pudo extraer ID de contacto de:', JSON.stringify(contactInput)?.substring(0,300));
    return null
  }
  console.log(`Buscando contacto ID real: ${contactId}`);
  // COMPATIBILIDAD V1/V2: intenta V2 primero (trae tax_id), si falla usa V1
  for (const ver of ["v2", "v1"]) {
    const url = ver === "v2"
  ? `https://api.clientify.net/${ver}/contacts/${contactId}/?fields=id,first_name,last_name,name,taxpayer_identification_number,emails,phones,main_address,addresses,company,company_details,company_id`
      : `https://api.clientify.net/${ver}/contacts/${contactId}/`;
    const res = await fetch(url, {
      headers: { "Authorization": `Token ${apiKey}` }
    });
    if (res.ok) {
      console.log(`✅ Contacto encontrado en ${ver}`);
      return res.json();
    }
    console.log(`⚠️ Contacto no encontrado en ${ver}: ${res.status}`);
  }
  console.log('❌ getFullContact falló en V1 y V2');
  return null;
}
async function getFullCompany(apiKey: string, companyInput: any) {
  const companyId = extractId(companyInput)
  if (!companyId) {
    console.log('❌ No se pudo extraer ID de empresa de:', JSON.stringify(companyInput)?.substring(0,300));
    return null
  }
  console.log(`Buscando empresa ID real: ${companyId}`);
  // COMPATIBILIDAD V1/V2: intenta V2 primero (trae tax_id), si falla usa V1
  for (const ver of ["v2", "v1"]) {
    const url = ver === "v2"
  ? `https://api.clientify.net/${ver}/companies/${companyId}/?fields=id,name,sector,company_sector,business_name,taxpayer_identification_number,fax,number_of_employees,number_of_employees_desc,owner,owner_name,rank,rank_manual,picture_url,facebook_url,linkedin_url,twitter_url,instagram_url,website,emails,phones,main_address,addresses`
      : `https://api.clientify.net/${ver}/companies/${companyId}/`;
    const res = await fetch(url, {
      headers: { "Authorization": `Token ${apiKey}` }
    });
    if (res.ok) {
      const data = await res.json();
      console.log(`✅ Empresa encontrada en ${ver}:`, JSON.stringify(data).substring(0,800));
      return data;
    }
    console.log(`⚠️ Empresa no encontrada en ${ver}: ${res.status}`);
  }
  console.log('❌ getFullCompany falló en V1 y V2');
  return null;
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
  // MEJORA V3: búsqueda insensible a mayúsculas para evitar errores
  const f = custom_fields.find((c: any) =>
    (c.field||'').toLowerCase() === name.toLowerCase() ||
    (c.name||'').toLowerCase() === name.toLowerCase()
  );
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

  // =================================================================
  // OBJETIVO 5.2.1: FILTRO - SOLO OPORTUNIDADES GANADAS
  // Clientify dispara el webhook con cualquier actualización de oportunidad.
  // Solo creamos evento en el integrador si se va a GANADA/WON.
  // =================================================================
  const estadoWebhook = String(
    body.status || body.data?.status || body.deal_status || body.data?.deal_status ||
    body.pipeline_status || body.data?.pipeline_status || body.state || body.data?.state ||
    body.stage || body.data?.stage || body.status_name || body.data?.status_name ||
    body.deal_stage || body.data?.deal_stage || ''
  ).toLowerCase()

  const esGanadaWebhook = ['ganada', 'ganado', 'won', 'closed_won', 'ganada - won', '3', '4'].some(k => estadoWebhook.includes(k))

  // Si el webhook trae estado y NO es ganada, ignoramos antes de crear el evento
  if (estadoWebhook &&!esGanadaWebhook) {
    console.log(`⏭️ Ignorado - Oportunidad ${body.id || body.data?.id} no está en Ganada, estado: ${estadoWebhook}`)
    return NextResponse.json({ ok: true, ignored: true, reason: `Estado no es Ganada: ${estadoWebhook}` })
  }

  // ===== DEDUP FIX V2 - evita doble evento de Clientify =====
  const incomingId = String(body.id || body.data?.id || '')
  const now = Date.now()
  if (incomingId) {
    const dupe = memoryLogs.find((l: any) => {
      if (String(l.oportunidad_id)!== incomingId) return false
      const t = new Date(l.fecha).getTime()
      return!isNaN(t) && (now - t) < 10000
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
    payload: body, // Guardamos todo el original por si se necesita revisar para el cliente Siigo
    // FIX ANTI-FALSO-LISTO - Inicializa como NO listo hasta que se carguen datos completos
    datos_completos_siigo: null,
    faltantes_para_facturar: ["Cargando datos completos de Clientify..."],
    listo_para_siigo: false
  }
  // Lo ponemos de primero en la lista de logs - PANEL BASICO: solo último evento
  memoryLogs = [entry]
  globalThis.__eventosClientify__ = memoryLogs
  ;(global as any).memoryLogs = memoryLogs

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
    if (!apiKey) {
      console.log('⚠️ Falta CLIENTIFY_API_KEY');
      entry.faltantes_para_facturar = ["Falta CLIENTIFY_API_KEY en ENV"]
      entry.listo_para_siigo = false
      return NextResponse.json({ ok: true, log: entry })
    }
    if (apiKey && dealId) {
      console.log(`🔍 Buscando datos completos para deal ${dealId}...`);
      const fullDeal = await getFullDeal(apiKey, dealId);
      console.log('DEAL RAW keys:', fullDeal? Object.keys(fullDeal) : 'null');

      if (!fullDeal) {
        console.log(`⚠️ fullDeal null para ${dealId} - no se pudo cargar`);
        entry.faltantes_para_facturar = [`No se pudo cargar deal ${dealId} desde Clientify API`]
        entry.listo_para_siigo = false
        return NextResponse.json({ ok: true, log: entry })
      }

      if (fullDeal) {
        // VALIDACIÓN EXTRA POR SI EL WEBHOOK NO TRAÍA ESTADO: verificamos el deal completo
        const estadoFullDeal = String(fullDeal.status || fullDeal.deal_status || fullDeal.pipeline_status || fullDeal.stage || fullDeal.status_name || fullDeal.deal_stage || '').toLowerCase()
        const esGanadaFull = ['ganada', 'ganado', 'won', 'closed_won', 'ganada - won', '3', '4'].some(k => estadoFullDeal.includes(k))
        console.log(`🔎 Estado FullDeal ${dealId}: "${estadoFullDeal}" esGanada=${esGanadaFull}`)
        if (estadoFullDeal &&!esGanadaFull) {
          console.log(`⏭️ Ignorado en FullDeal - deal ${dealId} estado: ${estadoFullDeal} - Se limpia evento incompleto`)
          // FIX: No dejar evento vacío con "Listo para Siigo", limpiar memoria
          memoryLogs = []
          globalThis.__eventosClientify__ = memoryLogs
          ;(global as any).memoryLogs = memoryLogs
          return NextResponse.json({ ok: true, ignored: true, reason: `FullDeal no es Ganada: ${estadoFullDeal}` })
        }

        // =================================================================
        // NUEVA LÓGICA V4 - DECISIÓN CLIENTE: PERSONA o EMPRESA (siigo_facturar_a)
        // Por qué existe: Normalmente una empresa está ligada a un contacto.
        // El cliente final debe decidir si quiere factura como persona natural
        // o jurídica. Creamos un campo en Oportunidades siigo_facturar_a
        // con opciones PERSONA / EMPRESA que predomina sobre la lógica automática.
        // Si es EMPRESA factura a company, si es PERSONA factura a contact.
        // Si no está definido, mantiene lógica anterior (prioriza empresa si existe).
        // =================================================================
        const contactInput = fullDeal.contact
        const companyInput = fullDeal.company

        let companyData = companyInput? await getFullCompany(apiKey, companyInput) : null
        let contactData = contactInput? await getFullContact(apiKey, contactInput) : null

        // =================================================================
        // FALLBACK V4.2 - Si la empresa está ligada al CONTACTO y no a la OPORTUNIDAD
        // Por qué existe: Pasa muy común que la empresa está ligada al contacto
        // y no a la oportunidad. Si el deal no trae empresa pero el contacto sí,
        // la buscamos desde contact.company / company_details.
        // FIX: company es solo nombre "Prueba Empresa Vinku", company_details trae URL con ID 17529395
        // =================================================================
        if (!companyData && contactData) {
          const cAny = contactData as any
          const companyFromContact = cAny.company_details || cAny.company || cAny.company_id
          if (companyFromContact) {
            console.log(`🔄 Deal sin empresa directa, pero contacto tiene empresa ligada: ${JSON.stringify(companyFromContact).substring(0,200)}, buscándola...`);
            companyData = await getFullCompany(apiKey, companyFromContact)
          }
        }

        // Lee decisión del cliente desde la oportunidad (campo personalizado)
        // FIX V6 - Guardamos RAW para validar si fue diligenciado o no
        const facturarA_raw =
          getCustomValue(fullDeal.custom_fields, "siigo_facturar_a") ||
          getCustomValue(fullDeal.custom_fields, "facturar_a") ||
          getCustomValue(fullDeal.custom_fields, "tipo_facturacion") ||
          null;

        const facturarA = (facturarA_raw || "").toLowerCase();

        const formaPagoDian_raw = getCustomValue(fullDeal.custom_fields, "siigo_forma_pago_dian") || null;
        const formaPagoDian = formaPagoDian_raw || "1";

        console.log(`🧾 Decisión facturación: siigo_facturar_a=${facturarA || 'no definido'} | tieneEmpresa=${!!companyData} tieneContacto=${!!contactData} | formaPago=${formaPagoDian_raw || 'no definido'}`);

        let clienteData: any = null
        let esEmpresa = false

        if (facturarA.includes("empresa") || facturarA.includes("juridica") || facturarA.includes("jurídica")) {
          // Cliente pidió factura como EMPRESA / JURÍDICA
          clienteData = companyData || contactData
          esEmpresa =!!companyData
          if (!companyData) console.log("⚠️ Pidió factura EMPRESA pero el deal no tiene empresa ligada, usando contacto");
        } else if (facturarA.includes("persona") || facturarA.includes("natural") || facturarA.includes("contacto")) {
          // Cliente pidió factura como PERSONA NATURAL / CONTACTO
          clienteData = contactData || companyData
          esEmpresa = false
        } else {
          // Sin decisión explícita -> lógica por defecto: prioriza empresa si existe, si no contacto
          clienteData = companyData || contactData
          esEmpresa =!!companyData
        }

        // Merge útil: si factura a empresa pero empresa no tiene email/tel, usa el del contacto ligado
        if (clienteData && companyData && contactData && esEmpresa) {
          clienteData = {
...companyData,
            emails: (companyData.emails && companyData.emails.length)? companyData.emails : contactData.emails,
            phones: (companyData.phones && companyData.phones.length)? companyData.phones : contactData.phones,
            _contact_fallback_used: true
          }
        }

        console.log('CLIENTE DATA RAW:', JSON.stringify(clienteData)?.substring(0, 4000));

        // NUEVA LÓGICA V3 - Usar Dirección principal (campo tipo maps) + soporte addresses[]
        const mainAddr = clienteData?.main_address || clienteData?.addresses?.[0] || {}
        // Fallback extra para tu cuenta donde address viene en campo raíz
        const ciudadTxt = mainAddr.city || clienteData?.city || (clienteData?.address?.toLowerCase?.().includes('cali')? 'Cali' : '') || ''
        const estadoTxt = mainAddr.state || clienteData?.state || (ciudadTxt.toLowerCase().includes('cali')? 'Valle del Cauca' : '') || ''
        const direccionTxt = mainAddr.address || mainAddr.street || mainAddr.formatted_address || clienteData?.address || clienteData?.street || ''
        const dianCodes = getDianCodes(ciudadTxt, estadoTxt)

        // PARCHE V3 - Buscar SKU real en /products/ porque products[0].sku viene vacío en deal
        // FIX PRODUCTO NOMBRE - También busca nombre real
        let skuReal = fullDeal.products?.[0]?.sku || fullDeal.products?.[0]?.code || null
        let nombreReal = fullDeal.products?.[0]?.name || fullDeal.products?.[0]?.product_name || fullDeal.products?.[0]?.title || null
        if ((!skuReal ||!nombreReal) && fullDeal.products?.[0]?.product_id) {
          try {
            const pRes = await fetch(`${CLIENTIFY_API}products/${fullDeal.products[0].product_id}/`, {
              headers: { "Authorization": `Token ${apiKey}` }
            });
            const pData = await pRes.json();
            console.log('PRODUCT RAW:', JSON.stringify(pData).substring(0, 2500));
            skuReal = skuReal || pData.sku || pData.code || pData.reference || null
            nombreReal = nombreReal || pData.name || pData.title || null
          } catch(e: any){ console.log('Error producto', e.message) }
        } else if (skuReal || nombreReal) {
           console.log('PRODUCT RAW directo del deal:', JSON.stringify(fullDeal.products?.[0]).substring(0, 2500));
        }

        // FIX PRODUCTO NOMBRE - Enriquecer productos con nombre y sku para que el panel muestre nombre
        // FIX MULTI-PRODUCTO - Ahora trae TODOS los productos, no solo [0], y resuelve SKU/nombre por product_id
        const productosEnriquecidosBase = fullDeal.products || []
        const productosEnriquecidos = await Promise.all(productosEnriquecidosBase.map(async (p: any, idx: number) => {
          let sReal = p.sku || p.code || null
          let nReal = p.name || p.product_name || p.title || null
          // Si falta SKU o nombre, buscar en /products/{id}/
          if ((!sReal ||!nReal) && p.product_id) {
            try {
              const pr = await fetch(`${CLIENTIFY_API}products/${p.product_id}/`, {
                headers: { "Authorization": `Token ${apiKey}` }
              })
              if (pr.ok) {
                const pd = await pr.json()
                sReal = sReal || pd.sku || pd.code || pd.reference || null
                nReal = nReal || pd.name || pd.title || null
                console.log(`PRODUCT RAW [${idx}]:`, JSON.stringify(pd).substring(0,1500))
              }
            } catch {}
          }
          // Fallback para primer producto con lo ya resuelto antes
          if (idx === 0) {
            sReal = sReal || skuReal
            nReal = nReal || nombreReal
          }
          return {
...p,
            sku: sReal || p.sku || p.code || `SIN-SKU-${idx}`,
            name: nReal || p.name || p.product_name || p.title || 'Producto',
            product_name: nReal || p.name || p.product_name || 'Producto',
            quantity: p.quantity || 1,
            price: p.price || p.unit_price || p.amount || 0
          }
        }))

        // FIX MULTI-PRODUCTO - Calcular total real de la oportunidad (suma de productos o amount del deal)
        const sumaProductos = productosEnriquecidos.reduce((acc: number, pr: any) => acc + (Number(pr.price || 0) * Number(pr.quantity || 1)), 0)
        const totalOportunidad = Number(fullDeal.amount || fullDeal.value || sumaProductos || entry.valor || 0)
        // Actualiza el valor del entry para que el header muestre el total completo
        entry.valor = totalOportunidad
        entry.contact = (fullDeal.contact_name || entry.contact)

        // Armamos el objeto que cualquier cliente Siigo necesita para facturar
        const dataParaSiigo = {
          // NIT nativo: CONTACTOS.Número de Identificación Fiscal / EMPRESAS.ID fiscal - FIX V5 agrega más variantes
          nit: clienteData?.taxpayer_identification_number || clienteData?.tax_id || clienteData?.nif || clienteData?.id_fiscal || clienteData?.identification || clienteData?.identification_number || clienteData?.document || clienteData?.dni || clienteData?.vat_number || clienteData?.id_number || getCustomValue(clienteData?.custom_fields, "siigo_nit") || getCustomValue(clienteData?.custom_fields, "nif") || getCustomValue(clienteData?.custom_fields, "nit") || null,
          tipo_doc_dian: getCustomValue(clienteData?.custom_fields, "siigo_tipo_doc_dian") || (esEmpresa? "31" : "13"),
          responsable_iva: getCustomValue(clienteData?.custom_fields, "siigo_responsable_iva") || null,
          razon_social: clienteData?.company_name || clienteData?.name || clienteData?.razon_social || entry.contact,
          // Dirección principal
          direccion: direccionTxt || getCustomValue(fullDeal.custom_fields, "siigo_direccion_fact") || null,
          ciudad_nombre: ciudadTxt,
          estado_nombre: estadoTxt,
          ciudad_dian: getCustomValue(clienteData?.custom_fields, "siigo_ciudad_dian") || dianCodes?.city_code || getCustomValue(fullDeal.custom_fields, "siigo_ciudad_dian") || null,
          email: clienteData?.email || clienteData?.emails?.[0]?.email || clienteData?.emails?.[0] || null,
          telefono: clienteData?.phone || clienteData?.phones?.[0]?.phone || null,
          // SKU nativo de PRODUCTOS
          sku: skuReal || productosEnriquecidos[0]?.sku || getCustomValue(fullDeal.custom_fields, "siigo_producto_sku") || null,
          producto_nombre: nombreReal || productosEnriquecidos[0]?.name || null, // FIX PRODUCTO NOMBRE - nuevo campo para el panel
          cantidad: productosEnriquecidos[0]?.quantity || getCustomValue(fullDeal.custom_fields, "siigo_cantidad") || 1,
          precio: productosEnriquecidos[0]?.price || fullDeal.amount || entry.valor,
          precio_total_oportunidad: totalOportunidad, // FIX MULTI-PRODUCTO - total completo
          forma_pago_dian: formaPagoDian,
          forma_pago_dian_raw: formaPagoDian_raw,
          facturar_a_raw: facturarA_raw,
          decision_facturacion: facturarA || "auto",
          // Debug
          productos_completos: productosEnriquecidos || [], // FIX PRODUCTO NOMBRE - ahora con nombre incluido + FIX MULTI-PRODUCTO todos
          custom_fields_encontrados: fullDeal.custom_fields || [],
          direccion_completa_obj: mainAddr,
          cliente_fuente: esEmpresa? 'EMPRESA' : 'PERSONA'
        };

        // Guardamos el resultado del enriquecimiento en el mismo log
        (entry as any).datos_completos_siigo = dataParaSiigo;
        (entry as any).cliente_data_raw = clienteData

        // Lista de lo que falta para poder llamar a Siigo (validación DIAN)
        // FIX V6 - Ahora bloquea si no diligencian facturar_a y forma_pago_dian
        // --- INICIO INTEGRACIÓN eligibility.ts ---
        // Se arma el Opportunity que pide checkEligibility() con lo que ya calculaste arriba.
        // No se duplican cálculos: nit/email vienen de dataParaSiigo, productos/importe de productosEnriquecidos/totalOportunidad.
        const eligibility = checkEligibility({
          id: String(fullDeal.id || dealId),
          name: fullDeal.name || fullDeal.title || "",
          status: "won",
          amount: totalOportunidad,
          products: productosEnriquecidos.map((p: any) => ({ name: p.name || p.product_name || "Producto", price: Number(p.price || 0), quantity: Number(p.quantity || 1) })),
          contact: { id: String(extractId(contactInput) || ""), name: dataParaSiigo.razon_social || "", email: dataParaSiigo.email || undefined, nit: dataParaSiigo.nit || undefined },
        })
        // --- FIN INTEGRACIÓN eligibility.ts ---
        ;(entry as any).faltantes_para_facturar = Array.from(new Set([
!facturarA_raw? "siigo_facturar_a (PERSONA/EMPRESA)" : null,
!formaPagoDian_raw? "siigo_forma_pago_dian" : null,
!dataParaSiigo.nit? "NIF/ID fiscal (Contacto/Empresa)" : null,
!dataParaSiigo.tipo_doc_dian? "siigo_tipo_doc_dian (13,31,22,41)" : null,
!dataParaSiigo.responsable_iva? "siigo_responsable_iva" : null,
!dataParaSiigo.ciudad_dian? "Dirección principal > Ciudad (mapear a DIAN)" : null,
!dataParaSiigo.sku? "PRODUCTOS.SKU" : null,
          // Faltantes de lib/eligibility.ts (sin productos, importe $0, falta NIT/email)
  ...eligibility.faltantes,
        ].filter(Boolean) as string[]));

        // Bandera final: true si ya tenemos todo para facturar al cliente Siigo
        ;(entry as any).listo_para_siigo = (entry as any).faltantes_para_facturar.length === 0;

        // --- INICIO INTEGRACIÓN clientifyNotes.ts ---
        // Si no es apta, deja la nota en la OPORTUNIDAD con los faltantes. No rompe el webhook si falla.
        if (!(entry as any).listo_para_siigo) {
          try { await crearNotaClientify(String(dealId), (entry as any).faltantes_para_facturar) } catch {}
        }
        // --- FIN INTEGRACIÓN clientifyNotes.ts ---

        console.log("📦 Datos para Siigo:", dataParaSiigo);

        // --- INICIO FACTURACIÓN + RETORNO A CLIENTIFY ---
        if ((entry as any).listo_para_siigo) {
          // PASO 10 - IDEMPOTENCIA POSTGRES: si ya existe en Postgres, no se duplica
          const yaEnPostgres = await getInvoiceByOpportunity(String(dealId))
          const yaFacturado =!!yaEnPostgres || (fullDeal.custom_fields || []).some((c: any) =>
            c.field === 'nro_factura_siigo' && c.value
          )
          if (yaFacturado) {
            console.log(`⏭️ Deal ${dealId} ya facturado, no se duplica. Postgres: ${yaEnPostgres?.invoice_id || 'no'} / Clientify: ${yaEnPostgres? 'ya en Postgres' : 'ya tiene nro_factura_siigo'}`)
          } else {
            const facturaMock = {
              id: `MOCK-${Date.now()}`,
              fecha: new Date().toISOString(),
              oportunidad_id: String(dealId),
              razon_social: dataParaSiigo.razon_social,
              nit: dataParaSiigo.nit,
              total: totalOportunidad,
              estado: 'CREADA',
              origen: 'MOCK' as const,
              data: dataParaSiigo,
              cliente_fuente: dataParaSiigo.cliente_fuente,
            }
            addFactura(facturaMock)
            await saveInvoice(String(dealId), facturaMock.id, facturaMock.total, facturaMock.origen)
            console.log(`✅ Factura MOCK creada: ${facturaMock.id} para deal ${dealId}`)
            const retorno = await enviarFacturaAClientify(apiKey, String(dealId), {
              invoiceId: facturaMock.id,
              total: facturaMock.total,
              fecha: facturaMock.fecha,
              origen: facturaMock.origen,
            })
            console.log('📤 Retorno a Clientify:', retorno)
          }
        } else {
          console.log(`⏭️ No se factura deal ${dealId}, faltantes:`, (entry as any).faltantes_para_facturar)
        }
        // --- FIN FACTURACIÓN + RETORNO A CLIENTIFY ---
      }
    }
  } catch (e: any) {
    console.log("⚠️ No se pudo obtener datos completos (normal si no hay API Key):", e.message);
    // FIX ANTI-FALSO-LISTO - Nunca dejar como Listo para Siigo si hubo error
    entry.faltantes_para_facturar = [`Error cargando datos: ${e.message}`]
    entry.listo_para_siigo = false
    entry.datos_completos_siigo = null
  }

  // 5.4 - Respondemos a Clientify que todo OK (200). Si no respondemos 200, Clientify reintenta.
  return NextResponse.json({ ok: true, log: entry })
}

export async function GET() {
  const logs = globalThis.__eventosClientify__ || memoryLogs
  return NextResponse.json({
    ok: true,
    status: 'webhook_activo',
    cliente: process.env.CLIENTE_NOMBRE || 'test',
    eventos: logs.slice(0,1)
  })
}
