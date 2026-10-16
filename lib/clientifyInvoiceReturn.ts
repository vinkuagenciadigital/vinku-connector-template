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
  // V2: PUT a la oportunidad
  // Endpoint: https://api.clientify.net/v2/deals/{id}/
  // En V2 los campos personalizados se mandan como claves directas,
  // no como array de custom_fields como en V1.
  const res = await fetch(`https://api.clientify.net/v2/deals/${dealId}/`, {
    method: "PUT",
    headers: {
      "Authorization": `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      nro_factura_siigo: factura.invoiceId,
      siigo_fecha_factura: factura.fecha,
      siigo_total_facturado: String(factura.total),
      siigo_origen_factura: factura.origen, // MOCK o REAL
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
