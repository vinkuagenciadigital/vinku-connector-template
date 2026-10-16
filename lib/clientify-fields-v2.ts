// lib/clientify-fields-v2.ts
// SOLO para la Fábrica. Usa v2 únicamente para CREAR la definición de los campos.
// El conector del cliente sigue en v1 sin cambios.
// Recibe la API Key DEL CLIENTE, no la de la fábrica.

const BASE_V2 = "https://api-plus.clientify.com/v2";

// Tipos de campo según schema.json de v2 (FieldTypeEnum)
const FIELD_TYPE = {
  DROPDOWN: 1,
  DATE: 2,
  TEXT: 3,
  TEXT_AREA: 4,
  NUMERIC: 5,
  URL: 6,
  CHECKBOX: 7,
  CURRENCY: 8,
  HIDDEN: 9,
  MULTISELECT: 10,
  PERCENTAGE: 17,
  DATETIME: 18,
  AUTO_NUMBER: 19,
  DECIMAL: 21,
} as const;

// Campos que necesita el conector Clientify <-> Siigo
// content_type = "deal" (oportunidad)
type CampoSiigo = {
  name: string;
  field_type: number;
  help_text: string;
  dropdown_choices?: string[];
};

const CAMPOS_SIIGO: CampoSiigo[] = [
  {
    name: "nro_factura_siigo",
    field_type: FIELD_TYPE.TEXT,
    help_text: "Número de factura generado en Siigo",
  },
  {
    name: "estado_facturacion_siigo",
    field_type: FIELD_TYPE.DROPDOWN,
    help_text: "Estado de facturación en Siigo",
    dropdown_choices: ["PENDIENTE", "FACTURADO", "ERROR"],
  },
  {
    name: "error_facturacion_siigo",
    field_type: FIELD_TYPE.TEXT_AREA,
    help_text: "Último error de Siigo al facturar",
  },
  {
    name: "siigo_invoice_id",
    field_type: FIELD_TYPE.TEXT,
    help_text: "ID interno de la factura en Siigo",
  },
  {
    name: "fecha_facturacion_siigo",
    field_type: FIELD_TYPE.DATETIME,
    help_text: "Fecha/hora de facturación en Siigo",
  },
];

export type ResultadoCampo = {
  name: string;
  status: "creado" | "ya_existia" | "error";
  id?: string;
  detail?: string;
};

async function listarExistentes(apiKey: string): Promise<Set<string>> {
  const headers = {
    Authorization: `Token ${apiKey}`,
    "Content-Type": "application/json",
  };

  const existentes = new Set<string>();
  let url: string | null = `${BASE_V2}/custom-fields/?content_type=deal&page_size=200`;

  // Paginación por si el cliente ya tiene muchos campos
  while (url) {
    const res: Response = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`Error listando custom-fields v2: ${res.status} ${await res.text()}`);
    }
    const data: any = await res.json();
    for (const c of data.results ?? []) {
      if (c.name) existentes.add(c.name);
    }
    url = data.next;
  }

  return existentes;
}

async function crearCampo(
  apiKey: string,
  campo: CampoSiigo
): Promise<ResultadoCampo> {
  const headers = {
    Authorization: `Token ${apiKey}`,
    "Content-Type": "application/json",
  };

  const payload: Record<string, unknown> = {
    content_type: "deal",
    name: campo.name,
    field_type: campo.field_type,
    help_text: campo.help_text,
    visible: true,
  };

  // Solo el dropdown lleva choices, según schema.json v2
  if (campo.dropdown_choices) {
    payload.dropdown_choices = campo.dropdown_choices.map((name) => ({ name }));
  }

  const res: Response = await fetch(`${BASE_V2}/custom-fields/`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const data: any = await res.json().catch(() => ({}));

  if (res.status === 201) {
    return { name: campo.name, status: "creado", id: String(data.id ?? "") };
  }

  // Si otro proceso lo creó entre el GET y el POST, lo tratamos como ya existente
  if (res.status === 400 && JSON.stringify(data).includes("name")) {
    return { name: campo.name, status: "ya_existia", detail: JSON.stringify(data) };
  }

  return { name: campo.name, status: "error", detail: `${res.status} ${JSON.stringify(data)}` };
}

/**
 * Función principal que llamará la Fábrica.
 * Uso: await ensureCustomFieldsV2(clientifyKeyDelCliente)
 */
export async function ensureCustomFieldsV2(apiKey: string): Promise<ResultadoCampo[]> {
  if (!apiKey) throw new Error("ensureCustomFieldsV2: falta apiKey del cliente");

  const existentes = await listarExistentes(apiKey);
  const resultados: ResultadoCampo[] = [];

  for (const campo of CAMPOS_SIIGO) {
    if (existentes.has(campo.name)) {
      resultados.push({ name: campo.name, status: "ya_existia" });
      continue;
    }
    const r = await crearCampo(apiKey, campo);
    resultados.push(r);
  }

  return resultados;
}
