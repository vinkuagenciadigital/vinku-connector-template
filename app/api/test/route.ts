import { createSiigoInvoice } from '@/lib/siigoService';

export async function GET() {
  const result = await createSiigoInvoice({
    clientName: 'Cliente Prueba Vinku',
    clientEmail: 'prueba@vinku.com',
    amount: 150000,
    dealId: 'TEST-123'
  });

  return Response.json(result);
}
