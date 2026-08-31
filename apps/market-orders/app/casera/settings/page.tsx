"use client";

import { useState } from "react";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import { useCasera } from "../casera-context";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { adminHeaders } from "@/lib/fetch";
import { QRCodeSVG } from "qrcode.react";

export default function CaseraSettingsPage() {
  const { user } = usePollarAuth();
  const { stall, hasToken, reload, setAdminToken } = useCasera();
  const [restoreToken, setRestoreToken] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [linked, setLinked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);

  if (!stall) return null;

  const stallUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/stall/${stall.id}`
      : "";

  async function copyUrl() {
    if (!stallUrl) return;
    await navigator.clipboard.writeText(stallUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function restoreAdmin() {
    const token = restoreToken.trim();
    if (!token || !stall) return;
    setRestoring(true);
    setRestoreMsg(null);
    // The token is validated against this stall's hash; `/api/order` is the
    // cheapest endpoint that requires it.
    const res = await fetch(`/api/order?stallId=${stall.id}`, {
      headers: adminHeaders(token),
    });
    if (res.ok) {
      setAdminToken(token);
      setLinked(true);
      setRestoreToken("");
      setRestoreMsg(null);
      await reload();
    } else {
      setRestoreMsg("Esa clave no coincide con este puesto.");
    }
    setRestoring(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col items-center gap-3 p-4">
        <h2 className="self-start font-semibold">QR del puesto (para imprimir)</h2>
        {stallUrl && <QRCodeSVG value={stallUrl} size={200} />}
        <div className="w-full break-all text-center text-xs text-muted">
          {stallUrl}
        </div>
        <Button
          variant="secondary"
          onClick={() => void copyUrl()}
          className="w-full"
        >
          {copied ? "Copiada ✓" : "Copiar link del puesto"}
        </Button>
      </Card>

      <Card className="p-4">
        <p className="text-sm font-medium">Tu dirección (donde pagan tus clientes)</p>
        <p className="mt-1 break-all font-mono text-xs text-muted">
          {user?.address}
        </p>
        <p className="mt-2 text-xs leading-5 text-muted">
          Los pagos llegan directo a tu balance de Pollar en USDC. Podés
          verlo en la pestaña Tablero.
        </p>
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold">Clave de administración</h2>
        {hasToken ? (
          <p className="mt-1 text-sm leading-6 text-muted">
            Este dispositivo está vinculado al puesto. La clave se mostró una
            sola vez al crear el puesto y por seguridad no se vuelve a ver.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm leading-6 text-muted">
              No guardaste la clave en este dispositivo. Pegala acá para
              administrar el puesto desde este dispositivo. Si la perdiste,
              no hay forma de recuperarla.
            </p>
            <div className="mt-3 flex gap-2">
              <Input
                placeholder="ct_..."
                value={restoreToken}
                onChange={(e) => setRestoreToken(e.target.value)}
                className="font-mono"
              />
              <Button
                onClick={() => void restoreAdmin()}
                disabled={!restoreToken.trim()}
                loading={restoring}
                className="px-3"
              >
                Vincular
              </Button>
            </div>
          </>
        )}
        {restoreMsg && <p className="mt-2 text-sm text-error">{restoreMsg}</p>}
        {linked && (
          <p className="mt-2 text-sm text-success">Puesto vinculado ✓</p>
        )}
      </Card>
    </div>
  );
}