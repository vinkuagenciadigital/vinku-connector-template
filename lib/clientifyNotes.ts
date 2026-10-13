// =================================================================
// CLIENTIFY NOTES - AVISO AL COMERCIAL DENTRO DE CLIENTIFY
// =================================================================
// IDEA CENTRAL:
// Cuando una oportunidad llega a GANADA pero NO es apta para
// facturar en Siigo (falta NIT, sin productos, importe $0, etc.),
// el panel /admin la muestra en rojo, pero el comercial vive en
// Clientify, no en el panel. Si no le avisamos ahí, no se entera.
// Esta función deja una NOTA en la ficha de la oportunidad en Clientify
// con la lista exacta de lo que falta corregir.
// =================================================================

// -----------------------------------------------------------------
// FUNCIÓN: crearNotaClientify
// -----------------------------------------------------------------
// ENTRADA:
// - dealId: ID numérico de la oportunidad en Clientify (ej: "123456").
//   Es a qué oportunidad se le pega la nota. En route.ts se pasa
//   dealId, que ya es el ID de la oportunidad del webhook.
// - faltantes: la misma lista que muestra el panel en rojo
//   (entry.faltantes_para_facturar). Viene de eligibility.ts +
//   validación DIAN en route.ts, ya sin duplicados.
// SALIDA:
// No devuelve nada útil. Si falla, no debe romper el webhook:
// en route.ts se llama dentro de try/catch.
// POR QUÉ USA process.env DIRECTO:
// La API Key vive en Vercel ENV -> CLIENTIFY_API_KEY. Así esta
// función no necesita que route.ts le pase la key, solo la
// oportunidad y los faltantes. Menos parámetros = menos errores.
// -----------------------------------------------------------------
export async function crearNotaClientify(dealId: string, faltantes: string[]) {
  // ---------------------------------------------------------------
  // BLOQUE 1: EL TEXTO DE LA NOTA
  // ---------------------------------------------------------------
  // Por qué este formato:
  // - Empieza con ❌ para que se vea a simple vista que algo falló.
  // - "Vinku - No se pudo generar factura en Siigo" dice QUÉ pasó.
  // - "Motivo: ..." lista los faltantes con " | " para que el
  //   comercial sepa EXACTAMENTE qué corregir, sin abrir el panel.
  // - "Corrige esto y vuelve a guardar..." dice CÓMO reintentar:
  //   al volver a guardar como Ganada, Clientify dispara de nuevo
  //   el webhook y volvemos a validar.
  // ---------------------------------------------------------------
  const texto = `❌ Vinku - No se pudo generar factura en Siigo.\nMotivo: ${faltantes.join(" | ")}\nCorrige esto y vuelve a guardar la oportunidad como Ganada para reintentar.`

  // ---------------------------------------------------------------
  // BLOQUE 2: EL POST A CLIENTIFY API
  // ---------------------------------------------------------------
  // Qué hace:
  // Crea una nota en Clientify con POST /v1/notes/.
  // - deal: a qué oportunidad se le pega la nota.
  // - comment: el texto del Bloque 1.
  // - Authorization: Token + CLIENTIFY_API_KEY de ENV.
  // Nota: No validamos la respuesta aquí. Si Clientify devuelve
  // error (ej: oportunidad no existe), route.ts lo captura con
  // try/catch y el webhook sigue respondiendo 200.
  // ---------------------------------------------------------------
  await fetch(`https://api.clientify.net/v1/notes/`, {
    method: "POST",
    headers: { Authorization: `Token ${process.env.CLIENTIFY_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ deal: dealId, comment: texto })
  })
}
