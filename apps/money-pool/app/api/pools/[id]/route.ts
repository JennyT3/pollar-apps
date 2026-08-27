import { NextResponse } from 'next/server';
import { getPoolWithTotal, updatePoolStatus } from '../../../../lib/pools';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (request.headers.get('x-app-request') !== 'true') {
    return NextResponse.json({ error: 'Unauthorized request' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const pool = await getPoolWithTotal(id);

    if (!pool) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
    }

    if (pool.deadline && new Date() > new Date(pool.deadline)) {
      pool.status = 'closed';
    }

    return NextResponse.json(pool);
  } catch (error) {
    console.error('Error getting pool:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (request.headers.get('x-app-request') !== 'true') {
    return NextResponse.json({ error: 'Unauthorized request' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const pool = await getPoolWithTotal(id);

    if (!pool) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
    }

    if (pool.status === 'closed' || (pool.deadline && new Date() > new Date(pool.deadline))) {
      return NextResponse.json({ error: 'Pool is already closed' }, { status: 400 });
    }

    const body = await request.json();
    if (body.organizerUserId !== pool.organizerUserId) {
      return NextResponse.json({ error: 'Only the organizer can close this pool' }, { status: 403 });
    }

    await updatePoolStatus(id, 'closed');
    const updatedPool = await getPoolWithTotal(id);
    return NextResponse.json(updatedPool);
  } catch (error) {
    console.error('Error updating pool:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
