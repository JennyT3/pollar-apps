# Spike: pago QR entre dos cuentas Pollar

Criterio bloqueante del issue #4.

## Qué valida

1. Dos cuentas Pollar de testnet (A y B).
2. `/spike` genera un QR con destinatario + monto (URL de la app, no SEP-7).
3. A abre o escanea el QR, confirma un pago con `runTx('payment', …)`.
4. El hash queda en pantalla y se puede abrir en stellar.expert testnet.

## Cómo correrlo

```bash
cd apps/pasanaku-circles
cp .env.example .env
# NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY=pub_testnet_…
pnpm install
pnpm dev
```

Abrí `/spike` en dos navegadores (o un teléfono + una laptop). Entrá con cuentas distintas. Pegá la dirección G… de B, monto `1`, escaneá el QR desde el teléfono de A, confirmá.

## Hallazgos

- El QR es una URL de la app (`/spike?to=G…&amount=1`), no un URI SEP-7. Pollar no expone un charge QR nativo; el prefill es nuestra página + `runTx`.
- `fetchTxHistory` no trae memo ni contraparte estructurada, así que la app confirma con el hash de `runTx` y verifica en Horizon.
- Google login en testnet a veces responde 500; email OTP sí funciona (mismo hallazgo que PRs hermanas).
- La cuenta que paga necesita XLM para la fee de red, no solo USDC.

## Hashes

Pendiente de corrida con `pub_testnet_…` y dos cuentas reales.

Cuando exista:

- Hash: `<pegar>`
- Explorer: https://stellar.expert/explorer/testnet/tx/<pegar>
- Checks: `successful`, `from` = A, `to` = B, amount, asset USDC (no XLM), memo id presente
