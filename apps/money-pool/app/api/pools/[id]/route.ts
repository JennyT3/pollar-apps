import { NextResponse } from 'next/server';
import { getPoolWithTotal, updatePoolStatus, toPublicPool } from '../../../../lib/pools';
import { requirePoolOrganizer } from '../../../../lib/server-auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {

  try {
    const { id } = await params;
    const pool = await getPoolWithTotal(id);

    if (!pool) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
    }

    return NextResponse.json(toPublicPool(pool));
  } catch (error) {
    console.error('Error getting pool:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pool = await getPoolWithTotal(id);

    if (!pool) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
    }

    if (pool.status === 'closed' || (pool.deadline && new Date() > new Date(pool.deadline))) {
      return NextResponse.json({ error: 'Pool is already closed' }, { status: 400 });
    }

    const auth = await requirePoolOrganizer(request, pool.organizerAddress);
    if (!auth.ok) return auth.response;

    await updatePoolStatus(id, 'closed');
    const updatedPool = await getPoolWithTotal(id);
    return NextResponse.json(updatedPool ? toPublicPool(updatedPool) : null);
  } catch (error) {
    console.error('Error updating pool:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
