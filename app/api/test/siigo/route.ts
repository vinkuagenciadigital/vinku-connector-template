export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { createSiigoInvoice } from '@/lib/siigoService';

export async function GET(req: Request) {
  try {
    if (!process.env.MOCK_SIIGO) process.env.MOCK_SIIGO = 'true';

    // 1. Tomamos los mismos datos reales que usa tu panel
    const url = new URL(req.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    const r = await fetch(`${baseUrl}/api/webhook/clientify`, { cache: 'no-store' });
    const data = await r.json();
    const eventos = data.eventos || [];

    if (eventos.length === 0) {
      return Response.json({ error: 'Aún no hay eventos de Clientify. Mueve una oportunidad a Ganada primero.' }, { status: 404 });
    }

    const ultimo = eventos[0]; // el más reciente
    const s = ultimo.datos_completos_siigo;

    if (!s) {
      return Response.json({ error: 'El evento no tiene datos_completos_siigo', evento: ultimo }, { status: 400 });
    }

    // 2. Simulamos la factura con esos datos 100% reales de Clientify
    const facturaSimulada = await createSiigoInvoice({
      clientName: s.razon_social,
      clientEmail: s.email,
      amount: s.precio_total_oportunidad || ultimo.valor,
      dealId: ultimo.oportunidad_id,
      nit: s.nit,
      tipoDoc: s.tipo_doc_dian,
      direccion: s.direccion,
      ciudadDian: s.ciudad_dian,
      productos: s.productos_completos,
      formaPago: s.forma_pago_dian
    } as any);

    return Response.json({
      mensaje: 'Test con datos REALES de Clientify -> Simulación Siigo OK',
      origen: 'Tomado de /api/webhook/clientify (lo mismo que ve tu panel)',
      datosReales: s,
      facturaSimulada
    });

  } catch (e: any) {
    return Response.json({ error: e.message, stack: e.stack }, { status: 500 });
  }
}
