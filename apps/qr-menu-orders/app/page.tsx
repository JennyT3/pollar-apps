import Link from "next/link";
import manifest from "@/pollar.manifest.json";
import { PollarLogo } from "@/components/ui/PollarLogo";

/**
 * Landing. There are only two ways into this app: the owner goes to /admin,
 * and the diner arrives by scanning a table's QR — never by typing a URL,
 * and never by copying a G… address.
 */
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-8 px-5 py-12">
      <div className="flex flex-col items-center gap-5 text-center">
        <PollarLogo size={88} />
        <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          {manifest.name}
          <span className="block text-primary">pedí y pagá desde la mesa</span>
        </h1>
        <p className="max-w-sm text-lg leading-8 text-muted">
          El menú siempre al día, el pedido llega escrito y ya pagado, y nadie
          persigue el cambio.
        </p>
      </div>

      <Link
        href="/admin"
        className="flex h-14 items-center justify-center rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary-hover active:scale-[0.98]"
      >
        Soy el dueño — cargar mi menú
      </Link>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-semibold">¿Estás en una mesa?</h2>
        <p className="text-sm leading-6 text-muted">
          Escaneá el QR del local con la cámara de tu celular. Se abre el menú
          de hoy, elegís, y pagás con tu cuenta Pollar en una confirmación.
        </p>
      </div>

      <p className="text-center text-xs text-muted-light">
        Pagos reales en USDC sobre Stellar testnet, vía Pollar.
      </p>
    </main>
  );
}
