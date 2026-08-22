import { and, eq, inArray } from "drizzle-orm";
import { db, dbReady } from "@/db/client";
import { diningTable, menuItem, orderItem, orders, restaurant } from "@/db/schema";
import { newMemoId } from "@/lib/ids";
import { multiply, sum } from "@/lib/money";

/**
 * Creates an unpaid order and hands back what the payment needs: the owner's
 * account, the total, and the reference to carry as a Stellar MEMO_ID.
 *
 * Prices and the total are read from the database, never from the request.
 * A client that could name its own total could order lunch for a cent.
 */
export async function POST(request: Request) {
  await dbReady();

  let body: { tableCode?: string; items?: { itemId: string; quantity: number }[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Pedido mal formado." }, { status: 400 });
  }

  const code = body.tableCode?.trim();
  const requested = (body.items ?? []).filter(
    (line) => line?.itemId && Number.isInteger(line.quantity) && line.quantity > 0
  );

  if (!code) return Response.json({ error: "Falta la mesa." }, { status: 400 });
  if (requested.length === 0) {
    return Response.json({ error: "El pedido está vacío." }, { status: 400 });
  }

  const [spot] = await db
    .select({ table: diningTable, restaurant })
    .from(diningTable)
    .innerJoin(restaurant, eq(diningTable.restaurantId, restaurant.id))
    .where(eq(diningTable.code, code))
    .limit(1);
  if (!spot) return Response.json({ error: "Esa mesa no existe." }, { status: 404 });

  // Only this restaurant's dishes, and only the ones still available today.
  const rows = await db
    .select()
    .from(menuItem)
    .where(
      and(
        eq(menuItem.restaurantId, spot.restaurant.id),
        inArray(
          menuItem.id,
          requested.map((line) => line.itemId)
        )
      )
    );

  const byId = new Map(rows.map((row) => [row.id, row]));
  const lines = [];
  for (const line of requested) {
    const item = byId.get(line.itemId);
    if (!item) {
      return Response.json({ error: "Un plato ya no está en el menú." }, { status: 409 });
    }
    if (!item.available) {
      return Response.json(
        { error: `Se acabó el “${item.name}”. Sacalo del pedido para seguir.` },
        { status: 409 }
      );
    }
    lines.push({ item, quantity: line.quantity });
  }

  const total = sum(lines.map((line) => multiply(line.item.price, line.quantity)));

  const [created] = await db
    .insert(orders)
    .values({
      restaurantId: spot.restaurant.id,
      tableId: spot.table.id,
      memoId: newMemoId(),
      status: "pending",
      total,
      // Snapshot: verifying this order later must check the account that was
      // current when it was placed, even if the owner switches accounts.
      payToAddress: spot.restaurant.ownerAddress,
    })
    .returning();

  await db.insert(orderItem).values(
    lines.map((line) => ({
      orderId: created.id,
      menuItemId: line.item.id,
      name: line.item.name,
      price: line.item.price,
      quantity: line.quantity,
    }))
  );

  return Response.json(
    {
      order: {
        id: created.id,
        memoId: created.memoId,
        total: created.total,
        payToAddress: created.payToAddress,
        status: created.status,
      },
    },
    { status: 201 }
  );
}
