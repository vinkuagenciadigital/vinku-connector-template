export type Opportunity = {
  id: string
  name: string
  status: string // won, lost, open
  amount: number
  products: { name: string; price: number; quantity: number }[]
  contact: { id: string; name: string; email?: string; nit?: string }
}

export type Eligibility = {
  apta: boolean
  faltantes: string[]
  importe: number
}

export function checkEligibility(opp: Opportunity): Eligibility {
  const faltantes: string[] = []
  
  // Ya filtramos antes: solo llegan won
  if (!opp.contact?.nit) faltantes.push("Falta NIT del contacto")
  if (!opp.contact?.email) faltantes.push("Falta email del contacto")
  if (!opp.products || opp.products.length === 0) faltantes.push("Sin productos - Importe $0")
  
  const importe = opp.products?.reduce((s, p) => s + p.price * p.quantity, 0) || 0
  if (importe <= 0) faltantes.push("Importe es $0")

  return { apta: faltantes.length === 0, faltantes, importe }
}
