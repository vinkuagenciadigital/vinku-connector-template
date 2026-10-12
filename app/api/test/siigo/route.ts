export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { createSiigoInvoice } from '@/lib/siigoService';
import { addFactura, getFacturas } from '@/lib/facturasStore';

// Limpia HTML gigante de Clientify -> texto plano corto para Siigo
function cleanDesc(html: any): string {
  if (!html) return ""
  let txt = String(html)
  // quita tags html <p>, <span>, data-sfc-cp, etc
  txt = txt.replace(/<[^>]*>/g, " ")
  // limpia espacios multiples
  txt = txt.replace(/\s+/g, " ").trim()
  // Siigo solo permite max 200-300 chars
  return txt.substring(0, 200)
}

export async function GET(req: Request) {
  try {
    if (!process.env.MOCK_SIIGO) process.env.MOCK_SIIGO = 'true';

    // 1. Tomamos los mismos datos reales que usa tu panel
    const url = new URL(req.url);
    // FIX PARPADEO: lee directo de memoria global, no hace fetch a sí mismo que cae en lambda vacía en Vercel
    const allLogs = (globalThis as any).__eventosClientify__ || (global as any).memoryLogs || []
    const seen = new Set<string>()
    const eventos: any[] = []
    for (const log of allLogs) {
      const id = String(log.oportunidad_id)
      if (!seen.has(id)) {
        seen.add(id)
        eventos.push(log)
      }
    }

    if (eventos.length === 0) {
      return Response.json({ error: 'Aún no hay eventos de Clientify. Mueve una oportunidad a Ganada primero.' }, { status: 404 });
    }

    const ultimo = eventos[0]; // el más reciente
    const s = ultimo.datos_completos_siigo;

    if (!s) {
      return Response.json({ error: 'El evento no tiene datos_completos_siigo', evento: ultimo }, { status: 400 });
    }

    // EVITA que se generen muchos MOCK del mismo ID
    const force = url.searchParams.get('force') === 'true';
    const existente = getFacturas().find(f => f.oportunidad_id === ultimo.oportunidad_id);
    if (existente &&!force) {
      return Response.json({
        mensaje: 'Ya existe una factura MOCK para esta oportunidad. No se generó otra.',
        facturaExistente: existente,
      });
    }

    // FIX PUNTO 2: Limpiamos descripcion HTML gigante antes de mandar a Siigo
    const productosLimpios = (s.productos_completos || []).map((p: any) => ({
    ...p,
      // guarda nombre corto
      name: (p.name || p.product_name || '').substring(0, 100),
      // limpia descripcion gigante de SFC
      description: cleanDesc(p.description || p.name || ''),
    }));

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
      productos: productosLimpios,
      formaPago: s.forma_pago_dian
    } as any);

    // NUEVO: Guardamos la factura para que aparezca en el panel derecho
    addFactura({
      id: (facturaSimulada as any).invoiceId || (facturaSimulada as any).id || `MOCK-${Date.now()}`,
      fecha: new Date().toISOString(),
      oportunidad_id: ultimo.oportunidad_id,
      razon_social: s.razon_social,
      nit: s.nit,
      total: s.precio_total_oportunidad || ultimo.valor,
      estado: (facturaSimulada as any).success? 'CREADA (MOCK)' : 'ERROR',
      origen: 'MOCK',
      data: facturaSimulada,
      cliente_fuente: s.cliente_fuente
    })

    return Response.json({
      mensaje: 'Test con datos REALES de Clientify -> Simulación Siigo OK',
      origen: 'Tomado de /api/webhook/clientify (lo mismo que ve tu panel)',
      // mostramos datos ya limpios para que no se vea el muro de HTML
      datosReales: {
      ...s,
        productos_completos: productosLimpios
      },
      facturaSimulada
    });

  } catch (e: any) {
    return Response.json({ error: e.message, stack: e.stack }, { status: 500 });
  }
}
