import { notFound } from 'next/navigation';
import { getPoolWithTotal } from '../../../lib/pools';
import { PoolLiveView } from '../../../components/PoolLiveView';

export default async function PoolPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pool = await getPoolWithTotal(id);

  if (!pool) {
    notFound();
  }

  return <PoolLiveView initialPool={pool} />;
}
