# Pasanaku digital

Círculos de ahorro rotativo sobre Pollar. El organizador crea el círculo (monto, frecuencia, orden de turnos). Los miembros entran con un QR o un link. Cada ronda se paga escaneando el QR de cobro: el USDC llega a la cuenta Pollar de quien le toca. El estado (pagó / debe / le toca) y el historial con hashes quedan a la vista.

Issue: https://github.com/pollar-xyz/pollar-apps/issues/4

## Correr desde un clone fresco

```bash
cd apps/pasanaku-circles
cp .env.example .env
pnpm install
pnpm dev
```

La única variable obligatoria es `NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY` (`pub_testnet_…` en https://dashboard.pollar.xyz → Build → API Keys).

La base es un archivo SQLite `data/pasanaku.db` (libSQL), creado al primer request. En Vercel seteá `TURSO_DATABASE_URL` (y `TURSO_AUTH_TOKEN` si aplica) porque el filesystem serverless no persiste.

## Cómo se usa

1. Entrá con Pollar.
2. **Crear círculo** (`/c/new`): nombre, monto USDC, frecuencia (semanal / quincenal / mensual). El organizador queda como primer miembro. Se muestra una vez la clave de organizador.
3. Compartí `/c/{code}/join` o el QR de unirse. Cada miembro entra con su login Pollar.
4. El QR de cobro (`/c/{code}/qr` o `/c/{code}/pay`) abre la app con destinatario y monto ya puestos. Un toque confirma el pago (`runTx('payment', …)` con memo id).
5. El servidor verifica el hash en Horizon (éxito, destino, monto). El historial linkea stellar.expert.

Nadie tipea una dirección `G…` en el flujo principal.

## Spike

`/spike` y `SPIKE.md`. Dos cuentas, un QR, un hash.

## Pins

`@pollar/core` y `@pollar/react` en `^0.11.2`, igual que el template (cumple `^0.11.0`).
