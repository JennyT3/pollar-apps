const HORIZON_URL = process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet' 
  ? 'https://horizon.stellar.org' 
  : 'https://horizon-testnet.stellar.org';

export const STELLAR_EXPERT_URL = process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet'
  ? 'https://stellar.expert/explorer/public'
  : 'https://stellar.expert/explorer/testnet';

function normalizeAmount(amt: string) {
  if (!amt.includes('.')) return amt + '.0000000';
  const [int, frac] = amt.split('.');
  return `${int}.${frac.padEnd(7, '0').slice(0, 7)}`;
}

export async function verifyTxOnHorizon(
  hash: string,
  expectedTo: string,
  expectedAmount: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const txRes = await fetch(`${HORIZON_URL}/transactions/${hash}`);
    if (!txRes.ok) {
      if (txRes.status === 404) {
        return { valid: false, error: "La transacción no existe en Horizon" };
      }
      return { valid: false, error: "Error de red al consultar Horizon" };
    }
    
    const txData = await txRes.json();
    if (!txData.successful) {
      return { valid: false, error: "La transacción falló en la red" };
    }
    
    const opsRes = await fetch(`${HORIZON_URL}/transactions/${hash}/operations`);
    if (!opsRes.ok) {
      return { valid: false, error: "Error al consultar operaciones de la transacción" };
    }
    
    const opsData = await opsRes.json();
    const ops = opsData._embedded.records;
    
    const normalizedExpected = normalizeAmount(expectedAmount);
    
    const paymentOp = ops.find((op: { type: string; to?: string; amount?: string }) => 
      op.type === "payment" && 
      op.to === expectedTo && 
      op.amount && normalizeAmount(op.amount) === normalizedExpected
    );
    
    if (!paymentOp) {
      return { valid: false, error: "La transacción no coincide con el destinatario y monto esperados" };
    }
    
    return { valid: true };
  } catch (err) {
    console.error("Error verifyTxOnHorizon:", err);
    return { valid: false, error: "Error de conexión con Horizon" };
  }
}
