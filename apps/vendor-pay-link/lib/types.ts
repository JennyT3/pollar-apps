/** Vendor profile keyed by Pollar wallet address (G…). */
export type Vendor = {
  address: string;
  /** Display name of the puesto / stall. */
  name: string;
  /** Short public code used in the permanent stall URL `/pay/s/{code}`. */
  publicCode: string;
  createdAt: string;
};

export type SaleKind = "stall" | "charge";
export type SaleStatus = "pending" | "paying" | "paid";

/**
 * One charge attempt. Created when the vendor makes a per-sale QR, or when a
 * buyer opens the stall QR and enters an amount.
 */
export type Sale = {
  id: string;
  vendorAddress: string;
  amount: string;
  note: string | null;
  kind: SaleKind;
  /** Linked charge id when kind === 'charge'. */
  chargeId: string | null;
  status: SaleStatus;
  /** Stellar text memo (≤28 chars) sent with the payment for matching. */
  memo: string;
  txHash: string | null;
  paidAt: string | null;
  /** When the buyer started paying (duplicate-pay lock). */
  claimedAt: string | null;
  createdAt: string;
};

/** Per-sale charge wrapper so the fixed QR stays stable. */
export type Charge = {
  id: string;
  vendorAddress: string;
  amount: string;
  note: string | null;
  saleId: string;
  createdAt: string;
};

export type StoreData = {
  vendors: Record<string, Vendor>;
  charges: Record<string, Charge>;
  sales: Record<string, Sale>;
};
