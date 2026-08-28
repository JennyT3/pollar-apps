import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { contributions } from '@/db/schema';
import { verifyTxOnRPC } from '@/lib/stellar';
import { nanoid } from 'nanoid';
import { getPoolWithTotal, updatePoolStatus } from '@/lib/pools';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {

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

    const existingTx = await db.query.contributions.findFirst({
      where: (fields, { eq }) => eq(fields.txHash, txHash)
    });

    if (existingTx) {
      return NextResponse.json({ error: 'This transaction has already been recorded' }, { status: 409 });
    }

    const verification = await verifyTxOnRPC(txHash, currentPool.organizerAddress, amount, id, contributorAddress);
    if (!verification.valid) {
      return NextResponse.json({ error: verification.error }, { status: 400 });
    }

    const onChainContributor = verification.from || null;

    const isOverGoal = (parseFloat(currentPool.total) + parseFloat(amount)) > parseFloat(currentPool.goalAmount) || currentPool.status === 'closed';

    const [contribution] = await db.insert(contributions).values({
      id: nanoid(),
      poolId: id,
      amount: amount,
      txHash: txHash,
      contributorName: contributorName || null,
      contributorAddress: onChainContributor,
      status: 'confirmed',
      overGoal: isOverGoal
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
