import { NextResponse } from 'next/server';
import { getUserOrganizedPools, getUserContributedPools } from '../../../../lib/pools';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address || !/^G[A-Z2-7]{55}$/.test(address)) {
      return NextResponse.json({ error: 'Dirección inválida' }, { status: 400 });
    }


    const [organized, contributed] = await Promise.all([
      getUserOrganizedPools(address),
      getUserContributedPools(address),
    ]);

    return NextResponse.json({ organized, contributed });
  } catch (error) {
    console.error('Error fetching user pools:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
