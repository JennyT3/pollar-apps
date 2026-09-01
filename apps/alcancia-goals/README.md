# Alcancía

Metas de ahorro personales y familiares sobre el SDK de Pollar. Creás una meta, la ves llenarse, y si es compartida, la familia aporta pagando por QR directo al balance de quien la guarda (el "keeper").

Construida sobre el [template de pollar-apps](../../template) — auth, balance y pagos ya vienen integrados; esta app solo agrega las pantallas, la persistencia propia y el flujo de QR.

## Setup rápido

```bash
cp .env.example .env
# pegá tu publishable key de dashboard.pollar.xyz (Build → API Keys)
pnpm install
pnpm dev
```

Nada más que la API key hace falta. La base de datos se crea sola en `./data/alcancia.db` la primera vez que corre.

## Base de datos

SQLite vía [`@libsql/client`](https://github.com/tursodatabase/libsql-client-ts), con el schema en [`lib/db.ts`](lib/db.ts) (`goals`, `set_asides`, `contributions`, `members`).

- **Local (`pnpm dev`)**: sin configurar nada, usa un archivo local en `./data/alcancia.db`, creado automáticamente.
- **Producción (Vercel)**: el filesystem de una función serverless no persiste entre invocaciones, así que un archivo local no sirve ahí. Apuntá `DATABASE_URL` (y `DATABASE_AUTH_TOKEN`) a una base libsql hosteada — por ejemplo [Turso](https://turso.tech) tiene un free tier que alcanza de sobra — y todo sigue funcionando sin tocar código, porque el cliente libsql habla el mismo protocolo con un archivo local o remoto.

## Los dos modos

### Personal

Apartar plata en una meta personal **no mueve dinero a ningún lado**: es solo una anotación de cuánto de tu balance de Pollar está "reservado" para esa meta (tabla `set_asides`). Podés apartar (`add`) o retirar (`withdraw`) contra la meta en cualquier momento.

**El coverage check** es el corazón de este modo. Pollar no tiene forma de congelar o custodiar un balance — es el mismo balance en todas las apps de Pollar — así que nada impide gastarlo desde otra app. Por eso, en cada carga se compara:

- tu **balance real** (en vivo, vía `useBalance()` del SDK)
- contra la **suma de todo lo apartado** en tus metas personales activas (nuestra propia base)

Si el balance real es menor, `components/CoverageBanner.tsx` avisa "tu alcancía está rota" con el faltante exacto. Es la sustitución honesta de un custodio: no evita que gastes esa plata, solo te avisa cuando ya lo hiciste.

**Límite conocido**: el coverage check no distingue *cuál* gasto rompió la cobertura ni en qué app pasó — solo que el balance real ya no alcanza para lo apartado.

### Compartida

Varios miembros aportan a una meta con **pagos reales en USDC sobre Stellar testnet**, que llegan directo al balance del keeper (quien creó la meta). Cada aporte pasa por el flujo de pago del template (`PayButton` vía `runTx('payment', …)`, ver [`components/ContributeFlow.tsx`](components/ContributeFlow.tsx)) — nunca se reimplementa ni se firma nada por fuera del SDK.

Al confirmarse el pago, la app manda el hash a `POST /api/goals/[id]/contributions`, que lo verifica contra Horizon testnet (`lib/horizon.ts`) antes de grabar nada: destino = keeper de la meta, asset = USDC con el issuer de testnet, transacción exitosa, monto suficiente, y memo de texto igual al id de la meta (el `PayButton` lo manda así, ver `ContributeFlow.tsx`, para que un hash real no pueda reusarse contra otra meta). El `contributor_address` que se guarda sale de la operación on-chain (`from`), nunca del body del request. Si cualquiera de esos chequeos falla — incluida una caída de Horizon — el aporte se **rechaza**, no se graba sin verificar.

**Simplificación de diseño**: el keeper de una meta compartida es siempre quien la creó — no se puede asignar a otra cuenta. Esto evita el problema de "asignar custodio sin su consentimiento" y mantiene el modelo de confianza simple: quien crea la meta es quien la guarda.

## El flujo de QR

Cada meta compartida tiene dos QR, ambos deep links a esta misma app (no se necesita escáner propio: cualquier cámara de celular los abre):

- **QR de contribución** (`/contribute?goal=<id>`): abre la pantalla de pago con el keeper y la referencia de la meta precargados, a un toque de confirmar.
- **QR de invitación** (`/join?goal=<id>`): suma al que lo abre como miembro de la meta, sin pagar todavía.

Escribir a mano una dirección `G…` nunca es el flujo principal — ambos casos existen justamente para evitarlo.

## El spike (obligatorio antes del resto)

[`app/spike/page.tsx`](app/spike/page.tsx) + [`app/spike/pay/page.tsx`](app/spike/pay/page.tsx) reproducen el loop de pago aislado de la base de datos de metas, con dos cuentas de prueba:

1. Iniciá sesión en `/spike` con la cuenta A (el "keeper"). Ingresá un monto y una referencia; la página genera un QR que codifica `/spike/pay?to=<direcciónA>&amount=…&ref=…`.
2. En otro dispositivo o navegador, iniciá sesión con la cuenta B (el "contribuyente") y abrí ese link — escaneando el QR o pegando el link.
3. Cuenta B paga con una confirmación a través de `PayButton` (mismo `runTx('payment', …)` que el resto de la app).
4. El balance de la cuenta A se actualiza solo (el `BalanceCard` mira el estado global de `tx` del SDK) y la pantalla de B muestra el hash con un link a stellar.expert (testnet).

Nada de esto necesitó nada por fuera de lo que ya trae el template — el "prefill" es simplemente parsear los query params del link en la pantalla de pago.

## Autenticación de escrituras

Cambiar el estado de una meta, apartar/retirar en modo personal y unirse a una meta compartida exigen una firma [SEP-53](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0053.md) del address involucrado (`client.stellar.sep53.signMessage(...)` del SDK), no solo declarar el address en el body — que es público (aparece en el QR y en el historial) y no prueba nada por sí solo. El cliente firma un mensaje que ata acción + meta + address + una expiración de 5 minutos (`lib/sep53.ts`), lo manda en el header `x-alcancia-auth`, y el servidor verifica esa firma contra el address antes de aplicar el cambio (`lib/auth.ts`). Mismo patrón que usan `bill-split` y `money-pool`.

Las contribuciones a metas compartidas no necesitan este mecanismo aparte: el pago on-chain ya es la prueba (ver arriba).

## Qué falta para producción real

- El deploy productivo necesita una base de datos libsql hosteada (ver arriba); sin eso, las metas compartidas no son visibles entre miembros en Vercel.
- Crear una meta (`POST /api/goals`) todavía confía en el `ownerAddress` del body sin firma — no permite mover ni reclamar fondos de otra cuenta (solo el dueño real puede después apartar/retirar/cambiar el estado, que sí están firmados), así que quedó fuera del alcance de este fix.

## Testing con usuarios reales en Bolivia

Plan: crear una meta compartida (ej. "fondo de diciembre") con 3+ cuentas de prueba de una familia boliviana, cada quien escaneando el QR de contribución desde su propio celular como pagarían en la tienda o el mercado — sin explicación técnica de por medio, solo cámara → confirmar. El video (link abajo) muestra esa sesión: una meta compartida ("Family Vacation") recibiendo aportes reales de 3 cuentas por QR, más una meta personal llenándose y el aviso de coverage disparando cuando el balance real baja del total apartado.

**Video**: https://drive.google.com/file/d/19759w5bYxHug67RWdDI1C4yTQ0v3R3Bb/view?usp=sharing

## Estructura

```
app/
  page.tsx              lista de metas (home)
  goals/new/             crear meta
  goals/[id]/            detalle: progreso, apartar/retirar o contribuir, QR, miembros, historial
  contribute/             landing del QR de contribución
  join/                   landing del QR/link de invitación
  spike/                  spike aislado del loop de pago por QR
  api/goals/…             persistencia (crear, listar, detalle, set-aside, join, contributions)
  api/coverage/           total apartado por usuario, para el coverage check
components/
  GoalQR, ProgressBar, CoverageBanner, EmojiPicker, GoalCard,
  SetAsideModal, ContributeFlow, HistoryList
lib/
  db.ts, goals.ts         acceso a datos (libsql)
  decimal.ts              matemática decimal exacta sobre montos
  horizon.ts              verificación de hash contra Horizon testnet
  api.ts                  cliente fetch tipado para el frontend
```
