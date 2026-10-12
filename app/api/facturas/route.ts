export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { getFacturas } from '@/lib/facturasStore';

export async function GET() {
  return Response.json({ facturas: getFacturas() });
}
