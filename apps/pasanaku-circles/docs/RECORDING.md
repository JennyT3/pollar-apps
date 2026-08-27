# Guion del video (Bolivia)

El issue pide un círculo de al menos 3 cuentas, una ronda completa pagada por QR, el pozo en la cuenta correcta, y gente en Bolivia escaneando desde el teléfono.

## Antes

- 3 cuentas Pollar testnet (email OTP es más estable que Google)
- USDC de testnet + XLM para fees en las dos que van a pagar
- La app desplegada o `pnpm dev` alcanzable en la misma red

## Tomas

1. Home: "Pasanaku digital" y los nombres regionales (tanda, pandero, …)
2. Crear círculo: nombre, 1 USDC, semanal
3. QR de unirse: dos teléfonos entran con Pollar
4. Orden de turnos: sortear o subir/bajar
5. QR de cobro de la ronda 1
6. Quien cobra NO paga. Los otros dos escanean, confirman, ven el hash
7. Balance Pollar de quien cobra: +(2 × monto)
8. Dashboard: Pagó / Debe / Le toca, historial con timestamp, pagador, destinatario, explorer
9. (Opcional) terminar todas las rondas hasta "Círculo cerrado"

## Qué no filmar

- Tipear una dirección `G…` como flujo principal
- Un pago en XLM

Los diagramas en `docs/diagrams/output/` y las capturas en `docs/screenshots/FLOW.md` sirven de storyboard.
