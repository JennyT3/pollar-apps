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
- Pollar no fondea la cuenta con friendbot ni establece la trustline de USDC al crearla. Hay que fondear con friendbot y activar la trustline manualmente antes del primer pago (Pollar la habilita en cuanto la cuenta interactúa con USDC dentro de la app).
- `DEFAULT_USDC_ISSUER` en `lib/asset.ts` tenía un typo de transcripción (checksum de strkey inválido), no era el issuer real de Circle en testnet. Los tests no lo agarraron porque los fixtures mockeaban Horizon con el mismo valor incorrecto. Corregido antes de este spike; sin el fix, este pago real hubiera fallado el chequeo de asset en `confirmPayment`.

## Hashes

- Hash: `ac1002b384d5b4794c5ef74aba81e00428e352e41c0c8f9c0b603aa7727c6d7e`
- Explorer: https://stellar.expert/explorer/testnet/tx/ac1002b384d5b4794c5ef74aba81e00428e352e41c0c8f9c0b603aa7727c6d7e
- Checks verificados contra Horizon: `successful: true`, una sola operación `payment`, `from` = cuenta pagadora, `to` = cuenta que le tocaba cobrar, `amount: 10.0000000`, asset `USDC` con el issuer correcto (`GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`, no XLM), memo tipo `id` presente.
