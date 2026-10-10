import { NextRequest, NextResponse } from 'next/server'

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
  return f?.value || null;
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

  // 5.3 - Creamos una entrada resumida para el panel /admin
  // Usamos || porque el payload de prueba y el real vienen en formatos distintos
  // body.id vs body.data.id, body.contact.name vs body.data.contact_name
  const entry = {
    fecha: new Date().toISOString(),
    oportunidad_id: body.id || body.data?.id || 'test_'+Date.now(),
    contact: body.contact?.name || body.data?.contact_name || body.name || 'Contacto Test',
    valor: body.value || body.data?.amount || 0,
    estado: '✅ RECIBIDO - Simulación F1',
    payload: body // Guardamos todo el original por si se necesita revisar para el cliente Siigo
  }
  // Lo ponemos de primero en la lista de logs
  memoryLogs.unshift(entry)

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
        // Armamos el objeto que cualquier cliente Siigo necesita para facturar
        const dataParaSiigo = {
          nit: getCustomValue(fullDeal.custom_fields, "siigo_nit"),
          ciudad_dian: getCustomValue(fullDeal.custom_fields, "siigo_ciudad_dian") || getCustomValue(fullDeal.custom_fields, "siigo_ciudad_facturacion"),
          direccion: getCustomValue(fullDeal.custom_fields, "siigo_direccion_fact"),
          // El SKU puede venir de un campo personalizado o del primer producto agregado a la oportunidad
          sku: getCustomValue(fullDeal.custom_fields, "siigo_producto_sku") || fullDeal.products?.[0]?.sku || null,
          // La cantidad igual, del campo personalizado o de products.quantity
          cantidad: getCustomValue(fullDeal.custom_fields, "siigo_cantidad") || fullDeal.products?.[0]?.quantity || null,
          productos_completos: fullDeal.products || [],
          custom_fields_encontrados: fullDeal.custom_fields || []
        };

        // Guardamos el resultado del enriquecimiento en el mismo log
        (entry as any).datos_completos_siigo = dataParaSiigo;

        // Lista de lo que falta para poder llamar a Siigo (validación DIAN)
        (entry as any).faltantes_para_facturar = [
       !dataParaSiigo.nit? "siigo_nit" : null,
       !dataParaSiigo.sku? "siigo_producto_sku / producto en deal" : null,
       !dataParaSiigo.cantidad? "siigo_cantidad" : null,
        ].filter(Boolean);

        // Bandera final: true si ya tenemos todo para facturar al cliente Siigo
        (entry as any).listo_para_siigo = (entry as any).faltantes_para_facturar.length === 0;

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
