export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { createSiigoInvoice } from '@/lib/siigoService';

export async function GET() {
  try {
    // En el endpoint de test de fábrica siempre forzamos mock
    // para que el Build no dependa de envs de Vercel
    if (!process.env.MOCK_SIIGO) {
      process.env.MOCK_SIIGO = 'true';
    }

    const result = await createSiigoInvoice({
      clientName: 'Cliente Prueba Vinku',
      clientEmail: 'prueba@vinku.com',
      amount: 150000,
      dealId: 'TEST-123'
    });
    return Response.json(result);
  } catch (error: any) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}
