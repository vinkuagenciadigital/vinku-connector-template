export async function crearNotaClientify(contactId: string, faltantes: string[]) {
  const texto = `❌ Vinku - No se pudo generar factura en Siigo.\nMotivo: ${faltantes.join(" | ")}\nCorrige esto y vuelve a guardar la oportunidad como Ganada para reintentar.`

  await fetch(`https://api.clientify.net/v1/notes/`, {
    method: "POST",
    headers: { Authorization: `Token ${process.env.CLIENTIFY_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ contact: contactId, comment: texto })
  })
}
