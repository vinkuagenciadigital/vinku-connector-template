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
// content_type = "deal" (oportunidad) o "contact" (contacto)
type CampoSiigo = {
  name: string;
  field_type: number;
  help_text: string;
  dropdown_choices?: string[];
  content_type?: "deal" | "contact";
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
  // --- 4 campos de entrada en Deal (viejos) ---
  {
    name: "siigo_facturar_a",
    field_type: FIELD_TYPE.DROPDOWN,
    help_text: "A quién se le factura",
    dropdown_choices: ["PERSONA", "EMPRESA"],
  },
  {
    name: "siigo_forma_pago_dian",
    field_type: FIELD_TYPE.DROPDOWN,
    help_text: "Forma de pago DIAN: 1=Contado, 2=Crédito",
    dropdown_choices: ["1", "2"],
  },
  {
    name: "siigo_origen_factura",
    field_type: FIELD_TYPE.TEXT,
    help_text: "Origen de la factura - campo libre por ahora",
  },
  {
    name: "siigo_total_facturado",
    field_type: FIELD_TYPE.CURRENCY,
    help_text: "Total a facturar en Siigo",
  },
  // --- 2 campos en Contacto ---
  {
    name: "siigo_tipo_doc_dian",
    field_type: FIELD_TYPE.DROPDOWN,
    help_text: "Tipo de documento DIAN: 13=CC, 31=NIT, 22=CE, 41=Pasaporte, 47=PEP",
    dropdown_choices: ["13", "31", "22", "41", "47"],
    content_type: "contact",
  },
  {
    name: "siigo_responsable_iva",
    field_type: FIELD_TYPE.DROPDOWN,
    help_text: "Responsabilidad frente al IVA para facturación electrónica DIAN",
    dropdown_choices: ["Responsable de IVA", "No Responsable"],
    content_type: "contact",
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
  for (const content_type of ["deal", "contact"]) {
    let url: string | null = `${BASE_V2}/custom-fields/?content_type=${content_type}&page_size=200`;

    // Paginación por si el cliente ya tiene muchos campos
    while (url) {
      const res: Response = await fetch(url, { headers });
      if (!res.ok) {
        throw new Error(`Error listando custom-fields v2: ${res.status} ${await res.text()}`);
      }
      const data: any = await res.json();
      for (const c of data.results ?? []) {
        if (c.name) existentes.add(`${content_type}:${c.name}`);
      }
      url = data.next;
    }
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

  const content_type = campo.content_type ?? "deal";

  const payload: Record<string, unknown> = {
    content_type,
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
    const content_type = campo.content_type ?? "deal";
    if (existentes.has(`${content_type}:${campo.name}`)) {
      resultados.push({ name: campo.name, status: "ya_existia" });
      continue;
    }
    const r = await crearCampo(apiKey, campo);
    resultados.push(r);
  }

  return resultados;
}
