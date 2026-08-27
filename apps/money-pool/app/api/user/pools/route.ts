import { NextResponse } from 'next/server';
import { getUserOrganizedPools, getUserContributedPools } from '../../../../lib/pools';

export async function GET(request: Request) {
  if (request.headers.get('x-app-request') !== 'true') {
    return NextResponse.json({ error: 'Unauthorized request' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
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
