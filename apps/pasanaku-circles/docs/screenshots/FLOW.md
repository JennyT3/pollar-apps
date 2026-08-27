# Evidencia del flujo

Capturas reales de la app (móvil 390px y desktop 1280px) más los diagramas que definen el comportamiento. Regenerar con `pnpm screenshots` y `pnpm diagrams`.

## Cómo está definido

| Diagrama | Qué muestra |
|---|---|
| [Arquitectura](../diagrams/output/01-system-architecture.png) | Pollar SDK, API, Turso, Horizon |
| [QR](../diagrams/output/02-qr-contribution-flow.png) | Escanear, `runTx`, confirmar hash |
| [Estados](../diagrams/output/03-circle-state-machine.png) | open → active → completed |
| [Verificación](../diagrams/output/04-payment-verification.png) | 10 XLM no es 10 USDC |
| [Ronda](../diagrams/output/05-round-lifecycle.png) | N-1 pagan al que le toca |
| [Turnos](../diagrams/output/06-turn-order.png) | FIFO, sorteo, lock |

![Arquitectura](../diagrams/output/01-system-architecture.png)
![Flujo QR](../diagrams/output/02-qr-contribution-flow.png)
![Estados](../diagrams/output/03-circle-state-machine.png)
![Verificación de pago](../diagrams/output/04-payment-verification.png)
![Ronda](../diagrams/output/05-round-lifecycle.png)
![Orden de turnos](../diagrams/output/06-turn-order.png)

## Cómo funciona (móvil, el flujo de Bolivia)

### 1. Home: pasanaku digital

![Home móvil](mobile/01-home.png)

### 2. Nombres regionales (tanda, pandero, natillera, …)

![Nombres regionales móvil](mobile/02-home-nombres-regionales.png)

### 3. Crear círculo

![Crear círculo móvil](mobile/03-crear-circulo.png)

### 4. Spike QR (criterio bloqueante del issue)

![Spike QR móvil](mobile/04-spike-qr.png)

### 5. Unirse con Pollar

![Unirse móvil](mobile/05-unirse.png)

### 6. QR de cobro y QR de unirse

![QRs móvil](mobile/06-qrs-join-y-pago.png)

### 7. Dashboard abierto: estado y sorteo de turnos

![Dashboard abierto móvil](mobile/07-dashboard-abierto-turnos.png)

### 8. Pagar la ronda (sin tipear G…)

![Pagar ronda móvil](mobile/08-pagar-ronda.png)

### 9. Ronda en curso: pagó / debe / le toca

![Ronda en curso móvil](mobile/09-dashboard-ronda-en-curso.png)

### 10. Historial: timestamp, pagador, destinatario, hash

![Historial móvil](mobile/10-historial.png)

### 11. Círculo cerrado. Nadie en "Le toca"

![Cerrado móvil](mobile/11-dashboard-cerrado.png)

## Desktop

Las mismas 11 pantallas en `desktop/`.

![Home desktop](desktop/01-home.png)
![Nombres regionales desktop](desktop/02-home-nombres-regionales.png)
![Crear círculo desktop](desktop/03-crear-circulo.png)
![Spike QR desktop](desktop/04-spike-qr.png)
![Unirse desktop](desktop/05-unirse.png)
![QRs desktop](desktop/06-qrs-join-y-pago.png)
![Dashboard abierto desktop](desktop/07-dashboard-abierto-turnos.png)
![Pagar ronda desktop](desktop/08-pagar-ronda.png)
![Ronda en curso desktop](desktop/09-dashboard-ronda-en-curso.png)
![Historial desktop](desktop/10-historial.png)
![Cerrado desktop](desktop/11-dashboard-cerrado.png)
