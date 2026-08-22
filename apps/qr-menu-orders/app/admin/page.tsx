import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { currentRestaurant } from "@/lib/admin-auth";
import { middleTruncate } from "@/lib/format";
import { getMenu, getTables, getTodaySummary } from "@/lib/queries";
import { ClaimRestaurant } from "./ClaimRestaurant";

export default async function AdminHome() {
  const restaurant = await currentRestaurant();

  if (!restaurant) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
        <h1 className="text-3xl font-extrabold tracking-tight">
          Tu menú, en un QR
        </h1>
        <ClaimRestaurant />
      </main>
    );
  }

  const [menu, tables, today] = await Promise.all([
    getMenu(restaurant.id),
    getTables(restaurant.id),
    getTodaySummary(restaurant.id),
  ]);
  const dishes = menu.reduce((acc, category) => acc + category.items.length, 0);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Cobrado hoy" value={`${today.total} USDC`} />
        <Stat label="Pedidos hoy" value={String(today.count)} />
        <Stat label="Platos en el menú" value={String(dishes)} />
      </div>

      <Card>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Tu local
        </h2>
        <dl className="mt-3 flex flex-col divide-y divide-border text-sm">
          <Row label="Nombre" value={restaurant.name} />
          <Row
            label="Los pagos van a"
            value={middleTruncate(restaurant.ownerAddress, 6, 6)}
            mono
          />
          <Row label="Mesas con QR" value={String(tables.length)} />
        </dl>
      </Card>

      {dishes === 0 && (
        <Card>
          <h2 className="font-semibold">Empezá por acá</h2>
          <p className="mt-1 text-sm text-muted">
            Cargá una categoría y unos platos, después creá tu primera mesa
            para tener su QR.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/admin/menu"
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              Armar el menú
            </Link>
            <Link
              href="/admin/tables"
              className="rounded-xl border border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-surface-hover"
            >
              Crear una mesa
            </Link>
          </div>
        </Card>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </p>
      <p className="mt-1 font-mono text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-muted">{label}</dt>
      <dd className={mono ? "font-mono" : "font-medium"}>{value}</dd>
    </div>
  );
}
