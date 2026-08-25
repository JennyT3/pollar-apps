import { NextResponse } from 'next/server';
import { getPoolWithTotal } from '../../../../lib/pools';

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

    // Add empty contributions list as specified in TASKS.md 1.7
    return NextResponse.json({ ...pool, contributions: [] });
  } catch (error) {
    console.error('Error getting pool:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
