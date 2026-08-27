import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { contributions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyTxOnHorizon } from '@/lib/stellar';
import { nanoid } from 'nanoid';
import { getPoolWithTotal, updatePoolStatus } from '@/lib/pools';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (request.headers.get('x-app-request') !== 'true') {
    return NextResponse.json({ error: 'Unauthorized request' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { amount, txHash, contributorName, contributorAddress } = body;

    if (!amount || !txHash) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
    }

    const currentPool = await getPoolWithTotal(id);

    if (!currentPool) {
      return NextResponse.json({ error: 'Pool no encontrado' }, { status: 404 });
    }

    if (currentPool.status === 'closed' || (currentPool.deadline && new Date() > new Date(currentPool.deadline))) {
      return NextResponse.json({ error: 'Pool is closed, no more contributions accepted' }, { status: 400 });
    }

    if (parseFloat(currentPool.total) >= parseFloat(currentPool.goalAmount)) {
      return NextResponse.json({ error: 'El pool ya ha alcanzado su meta, no se aceptan más contribuciones' }, { status: 400 });
    }

    const newTotal = parseFloat(currentPool.total) + parseFloat(amount);
    if (newTotal > parseFloat(currentPool.goalAmount)) {
      const maxAllowed = parseFloat(currentPool.goalAmount) - parseFloat(currentPool.total);
      return NextResponse.json({ error: `El monto excede la meta del pool. Máximo permitido: ${maxAllowed.toFixed(2)} USDC` }, { status: 400 });
    }

    const existingTx = await db.query.contributions.findFirst({
      where: eq(contributions.txHash, txHash)
    });

    if (existingTx) {
      return NextResponse.json({ error: 'This transaction has already been recorded' }, { status: 409 });
    }

    const verification = await verifyTxOnHorizon(txHash, currentPool.organizerAddress, amount);
    if (!verification.valid) {
      return NextResponse.json({ error: verification.error }, { status: 400 });
    }

    const [contribution] = await db.insert(contributions).values({
      id: nanoid(),
      poolId: id,
      amount: amount,
      txHash: txHash,
      contributorName: contributorName || null,
      contributorAddress: contributorAddress || null,
      status: 'confirmed'
    }).returning();

    const updatedPool = await getPoolWithTotal(id);
    if (updatedPool && parseFloat(updatedPool.total) >= parseFloat(updatedPool.goalAmount)) {
      await updatePoolStatus(id, 'closed');
    }

    return NextResponse.json(contribution, { status: 201 });
  } catch (error) {
    console.error('Error in POST /contributions:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
