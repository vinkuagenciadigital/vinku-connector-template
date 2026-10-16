// =================================================================
// CLIENTIFYINVOICERETURN - RETORNO DE FACTURA A CLIENTIFY (V2)
// OBJETIVO: Después de crear una factura (hoy MOCK, mañana REAL),
// dejar guardado en la oportunidad de Clientify el número de factura.
// TODO EN V2: GET, PUT y POST siempre a /v2/
// =================================================================

export async function enviarFacturaAClientify(
  apiKey: string,
  dealId: string,
  factura: { invoiceId: string; total: number; fecha: string; origen: string }
) {
  // V2: PUT exige `name` y `amount` aunque solo queramos actualizar custom_fields.
  // Sin ellos Clientify responde 400: "Este campo es requerido."
  // Por eso primero hacemos GET para traer los valores actuales del deal.
  let name: string = `Oportunidad ${dealId}`
  let amount: number = factura.total
  try {
    const getRes = await fetch(`https://api.clientify.net/v1/deals/${dealId}/`, {
      headers: {
        "Authorization": `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
    console.log(`🔍 GET V1 deal ${dealId} para retorno: ${getRes.status}`);
    if (getRes.ok) {
      const deal = await getRes.json();
      if (deal.name) name = deal.name;
      if (deal.amount !== undefined && deal.amount !== null) amount = Number(deal.amount);
      console.log(`🔍 Retorno usará name="${name}" amount=${amount}`);
    }
  } catch (e: any) {
    console.log(`⚠️ GET V1 falló para retorno deal ${dealId}: ${e.message}, usando fallback name/amount`);
  }

  // V2: PUT a la oportunidad
  // Endpoint: https://api-plus.clientify.com/v2/deals/{id}/
  // En V2 los campos personalizados van como array custom_fields
  // con { field, value }, según doc de /v2/multiple-contacts.
  const res = await fetch(`https://api-plus.clientify.com/v2/deals/${dealId}/`, {
    method: "PUT",
    headers: {
      "Authorization": `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      amount,
      custom_fields: [
        { field: "nro_factura_siigo", value: factura.invoiceId },
        { field: "siigo_fecha_factura", value: factura.fecha },
        { field: "siigo_total_facturado", value: String(factura.total) },
        { field: "siigo_origen_factura", value: factura.origen }, // MOCK o REAL
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.log(`⚠️ No se pudo actualizar deal ${dealId} en Clientify V2: ${res.status} ${err}`);
    return { ok: false, status: res.status, error: err };
  }

  console.log(`✅ Factura ${factura.invoiceId} guardada en Clientify V2 deal ${dealId}`);
  return { ok: true, data: await res.json() };
}
