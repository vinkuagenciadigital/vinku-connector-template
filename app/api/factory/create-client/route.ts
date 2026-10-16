// app/api/factory/create-client/route.ts
// Endpoint de la Fábrica: crea los campos personalizados en la cuenta del CLIENTE.
// No toca el código v1 del conector.

import { NextResponse } from "next/server";
import { ensureCustomFieldsV2 } from "@/lib/clientify-fields-v2";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { clientifyKey } = body;

    if (!clientifyKey) {
      return NextResponse.json(
        { error: "Falta clientifyKey" },
        { status: 400 }
      );
    }

    // 1. Crear campos en la cuenta del cliente con v2
    const campos = await ensureCustomFieldsV2(clientifyKey);

    // 2. Aquí después agregaremos la creación del proyecto en Vercel
    // Por ahora solo devolvemos el resultado de los campos para probar

    return NextResponse.json({
      ok: true,
      campos,
    });
  } catch (e: any) {
    console.error("Error en factory/create-client:", e);
    return NextResponse.json(
      { error: e.message || "Error interno" },
      { status: 500 }
    );
  }
}
