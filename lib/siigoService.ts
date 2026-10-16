// =================================================================
// SIIGOSERVICE - SERVICIO PARA CREAR FACTURAS EN SIIGO
// =================================================================
// OBJETIVO: Es la única parte del proyecto que habla con Siigo
// para crear una factura. Todo lo demás (webhook, /admin, test)
// le pide a este archivo "crea la factura" y él se encarga.
//
// Por qué existe separado: Para que si mañana cambia la forma de
// llamar a Siigo (otra URL, otro token, otros campos), solo se
// toca este archivo y no todo el proyecto.
//
// Estado actual: Tiene 2 modos:
// 1. MOCK (simulado) -> para probar sin credenciales reales.
// 2. REAL (pendiente) -> cuando tengamos usuario/clave de Siigo.
// =================================================================

// =================================================================
// TIPO InvoiceData - QUÉ DATOS NECESITA PARA CREAR UNA FACTURA
// Es el contrato de entrada. Quien llame a createSiigoInvoice
// tiene que mandarle esto:
// =================================================================
type InvoiceData = {
  clientName: string; // Nombre / razón social del cliente a facturar
  clientEmail: string; // Email del cliente (Siigo lo pide para la factura electrónica)
  amount: number; // Valor total a facturar
  dealId?: string; // ID de la oportunidad en Clientify que originó la factura. Es opcional (?) pero lo usamos para rastrear y para idempotencia.
};

// =================================================================
// FUNCIÓN createSiigoInvoice - CREAR LA FACTURA
// Qué hace: Recibe los datos del cliente y el monto, y crea
// la factura en Siigo (o la simula si estamos en MOCK).
// Qué devuelve: Un objeto con success, invoiceId, message y data.
// - success: true si se creó bien, false si falló.
// - invoiceId: ID que devuelve Siigo (o MOCK-123... si es simulado).
// - message: texto para mostrar en logs / panel.
// - data: los datos que le mandamos, para debug.
//
// Quién la usa: /api/test/siigo y más adelante el webhook
// cuando ya esté conectado el flujo completo Clientify -> Siigo.
// =================================================================
export async function createSiigoInvoice(data: InvoiceData) {
  // Lee la variable de entorno MOCK_SIIGO de Vercel.
  // Si es 'true', NO llama a Siigo real, solo simula.
  // Si es 'false' o no existe, intenta ir a modo REAL.
  const isMock = process.env.MOCK_SIIGO === 'true';

  // =================================================================
  // MODO MOCK - SIMULACIÓN PARA PRUEBAS SIN CREDENCIALES
  // Por qué existe: Todavía no tenemos usuario/clave de la cuenta
  // Siigo del cliente, entonces no podemos crear facturas reales.
  // Con este modo probamos todo el flujo (webhook -> panel -> factura)
  // sin gastar facturas reales ni romper nada.
  // =================================================================
  if (isMock) {
    console.log('--- [MOCK SIIGO] Simulando factura ---');
    console.log('Cliente:', data.clientName);
    console.log('Monto:', data.amount);
    console.log('Deal:', data.dealId);
    
    // Devuelve una factura simulada con éxito.
    // El invoiceId es falso: "MOCK-" + fecha actual, solo para
    // identificarlo en el panel y en facturasStore.
    return {
      success: true,
      invoiceId: `MOCK-${Date.now()}`,
      message: 'Factura simulada creada (mock mode)',
      data
    };
  }

  // =================================================================
  // MODO REAL - CONEXIÓN REAL A SIIGO (PENDIENTE)
  // Qué falta: Cuando tengamos las credenciales de la cuenta
  // (usuario, access_key, partner_id), aquí va el fetch real a:
  // POST https://api.siigo.com/v1/invoices
  // con el token de autenticación y el cuerpo de la factura.
  // Por ahora, si alguien intenta usar modo real sin tenerlo
  // configurado, lanza error para no hacer creer que facturó.
  // =================================================================
  // Conexión real a Siigo (cuando tengamos credenciales)
  throw new Error('Modo real de Siigo aún no configurado');
}
