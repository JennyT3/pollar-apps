export const PUESTO_PROOF_HEADER = "x-puesto-proof";

export function authMessage(address: string, exp: number): string {
  return `puesto-auth:${address}:${exp}`;
}
