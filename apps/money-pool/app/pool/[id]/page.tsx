import { notFound } from 'next/navigation';
import { Card } from '../../../components/ui/Card';
import { getPoolWithTotal } from '../../../lib/pools';

export default async function PoolPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pool = await getPoolWithTotal(id);

  if (!pool) {
    notFound();
  }

  const formattedGoal = parseFloat(pool.goalAmount).toFixed(2);
  const formattedTotal = parseFloat(pool.total || '0').toFixed(2);

  return (
    <div className="max-w-md mx-auto mt-10 p-4">
      <Card className="p-6">
        <h1 className="text-3xl font-bold mb-2 text-center">{pool.name}</h1>
        {pool.description && (
          <p className="text-gray-600 mb-6 text-center">{pool.description}</p>
        )}

        <div className="bg-gray-100 p-4 rounded-lg mb-6 text-center">
          <p className="text-sm text-gray-500 uppercase tracking-wider font-semibold mb-1">
            Raised
          </p>
          <p className="text-2xl font-bold text-gray-900">
            ${formattedTotal}{' '}
            <span className="text-gray-500 text-lg font-normal">
              / ${formattedGoal} USDC
            </span>
          </p>
        </div>
      </Card>
    </div>
  );
}
