// =================================================================
// ELIGIBILITY - ¿ESTA OPORTUNIDAD SE PUEDE FACTURAR EN SIIGO?
// =================================================================
// IDEA CENTRAL:
// Clientify nos avisa que una oportunidad pasó a GANADA, pero "ganada"
// no significa "facturable". Para que Siigo acepte la factura, la DIAN
// exige datos mínimos. Este archivo es el ÚNICO lugar donde decidimos
// si una oportunidad está lista o no. Si mañana cambia una regla de
// la DIAN, solo se toca aquí, no en route.ts ni en el panel.
// =================================================================

// -----------------------------------------------------------------
// TIPO 1: Opportunity - La forma simplificada de una oportunidad
// -----------------------------------------------------------------
// Por qué existe este tipo:
// El webhook de Clientify trae un JSON gigante y desordenado
// (custom_fields, addresses, company_details...). No queremos que
// la lógica de elegibilidad dependa de ese formato.
// Primero convertimos ese JSON a esta forma limpia y luego validamos.
// Así eligibility.ts no sabe nada de Clientify, solo sabe de negocio.
// -----------------------------------------------------------------
export type Opportunity = {
  id: string
  name: string
  status: string // won, lost, open - Solo nos interesa "won"
  amount: number
  products: { name: string; price: number; quantity: number }[]
  contact: { id: string; name: string; email?: string; nit?: string }
}

// -----------------------------------------------------------------
// TIPO 2: Eligibility - El resultado de la validación
// -----------------------------------------------------------------
// Por qué devolvemos esto y no solo un boolean:
// - apta: true / false -> El panel lo usa para pintar VERDE o ROJO.
// - faltantes: lista de textos -> El panel los muestra en rojo y
//   la nota en Clientify los copia tal cual, para que el comercial
//   sepa EXACTAMENTE qué corregir, sin adivinar.
// - importe: total calculado -> Sirve para mostrar "$0" en el panel
//   y para detectar el caso "sin productos pero con amount".
// -----------------------------------------------------------------
export type Eligibility = {
  apta: boolean
  faltantes: string[]
  importe: number
}

// -----------------------------------------------------------------
// FUNCIÓN PRINCIPAL: checkEligibility
// -----------------------------------------------------------------
// ENTRADA: Una Opportunity ya limpia (ver Tipo 1)
// SALIDA: Eligibility (ver Tipo 2)
// REGLA DE ORO: Esta función NO llama a APIs, NO guarda en BD,
// NO crea notas. Solo revisa datos y dice qué falta. Eso la hace
// fácil de probar: le pasas un objeto y te dice si es apta.
// -----------------------------------------------------------------
export function checkEligibility(opp: Opportunity): Eligibility {
  const faltantes: string[] = []

  // ---------------------------------------------------------------
  // BLOQUE 1: IDENTIFICACIÓN FISCAL - EL NIT
  // ---------------------------------------------------------------
  // Por qué es obligatorio:
  // Siigo / DIAN no puede crear una factura electrónica sin saber
  // A QUIÉN se le factura. El NIT es la cédula de la empresa o
  // persona. Sin NIT, Siigo rechaza la factura.
  // De dónde viene:
  // En route.ts lo sacamos de clienteData.tax_id / nif / custom_fields.
  // Si ahí viene vacío, aquí lo marcamos.
  // ---------------------------------------------------------------
  if (!opp.contact?.nit) faltantes.push("Falta NIT del contacto")

  // ---------------------------------------------------------------
  // BLOQUE 2: CANAL DE ENTREGA - EL EMAIL
  // ---------------------------------------------------------------
  // Por qué es obligatorio:
  // La factura electrónica se debe enviar al correo del cliente.
  // Siigo exige un email válido para emitirla. Sin email, la
  // factura queda creada pero no se puede entregar / validar.
  // ---------------------------------------------------------------
  if (!opp.contact?.email) faltantes.push("Falta email del contacto")

  // ---------------------------------------------------------------
  // BLOQUE 3: QUÉ SE VENDE - LOS PRODUCTOS
  // ---------------------------------------------------------------
  // Por qué es obligatorio:
  // Una factura sin líneas de producto no tiene sentido: no dice
  // qué se vendió, ni SKU, ni cantidad. Siigo la rechazaría.
  // Caso típico que vimos en Vinku:
  // Oportunidad en Ganada pero sin productos agregados en Clientify.
  // ---------------------------------------------------------------
  if (!opp.products || opp.products.length === 0) {
    faltantes.push("Sin productos - Importe $0")
  }

  // ---------------------------------------------------------------
  // BLOQUE 4: CUÁNTO SE COBRA - EL IMPORTE
  // ---------------------------------------------------------------
  // Qué hace:
  // Suma precio * cantidad de cada producto para obtener el total
  // real. No confiamos solo en opp.amount porque a veces Clientify
  // trae amount = 0 aunque haya productos, o viceversa.
  // Por qué bloquea en $0:
  // Facturar $0 en Siigo genera una factura inválida ante la DIAN
  // y contamina los reportes. Mejor bloquear y avisar.
  // Nota: Si ya marcamos "Sin productos", este bloque también
  // marcará "Importe es $0" porque la suma da 0. Es intencional:
  // son dos síntomas del mismo problema y así el comercial lo ve claro.
  // ---------------------------------------------------------------
  const importe = opp.products?.reduce((s, p) => s + p.price * p.quantity, 0) || 0
  if (importe <= 0) faltantes.push("Importe es $0")

  // ---------------------------------------------------------------
  // BLOQUE 5: DECISIÓN FINAL
  // ---------------------------------------------------------------
  // Regla simple y sin excepciones:
  // - Si faltantes está vacío -> apta = true -> Panel VERDE.
  // - Si hay al menos 1 faltante -> apta = false -> Panel ROJO
  //   + Nota en Clientify con la lista de faltantes.
  // Así evitamos el error que teníamos antes: marcar como
  // "Listo para Siigo" aunque faltara algo.
  // ---------------------------------------------------------------
  return { apta: faltantes.length === 0, faltantes, importe }
}

// -----------------------------------------------------------------
// ADAPTADOR PARA TU route.ts ACTUAL (IMPORTANTE)
// -----------------------------------------------------------------
// Por qué existe:
// Tu route.ts hoy no tiene un objeto Opportunity limpio, tiene
// `dataParaSiigo`, `productosEnriquecidos`, `totalOportunidad`.
// Esta función convierte eso a Opportunity para que puedas usar
// checkEligibility() sin reescribir todo route.ts.
// Uso en route.ts, reemplazando tu array manual de faltantes:
//   const opp = toOpportunity(fullDeal, dataParaSiigo, productosEnriquecidos)
//   const { apta, faltantes } = checkEligibility(opp)
//   entry.faltantes_para_facturar = faltantes
//   entry.listo_para_siigo = apta
// -----------------------------------------------------------------
export function toOpportunity(
  fullDeal: any,
  dataParaSiigo: any,
  productosEnriquecidos: any[]
): Opportunity {
  return {
    id: String(fullDeal.id || fullDeal.deal_id || ""),
    name: fullDeal.name || fullDeal.title || "",
    status: String(fullDeal.status || "won"),
    amount: Number(dataParaSiigo?.precio_total_oportunidad || fullDeal.amount || 0),
    products: (productosEnriquecidos || []).map((p: any) => ({
      name: p.name || p.product_name || "Producto",
      price: Number(p.price || p.unit_price || 0),
      quantity: Number(p.quantity || 1),
    })),
    contact: {
      id: String(dataParaSiigo?.contact_id || fullDeal.contact_id || ""),
      name: dataParaSiigo?.razon_social || "",
      email: dataParaSiigo?.email || undefined,
      nit: dataParaSiigo?.nit || undefined,
    },
  }
}
