type InvoiceData = {
  clientName: string;
  clientEmail: string;
  amount: number;
  dealId?: string;
};

export async function createSiigoInvoice(data: InvoiceData) {
  const isMock = process.env.MOCK_SIIGO === 'true';

  if (isMock) {
    console.log('--- [MOCK SIIGO] Simulando factura ---');
    console.log('Cliente:', data.clientName);
    console.log('Monto:', data.amount);
    console.log('Deal:', data.dealId);
    
    return {
      success: true,
      invoiceId: `MOCK-${Date.now()}`,
      message: 'Factura simulada creada (mock mode)',
      data
    };
  }

  // Conexión real a Siigo (cuando tengamos credenciales)
  throw new Error('Modo real de Siigo aún no configurado');
}
