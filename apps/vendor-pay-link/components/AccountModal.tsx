"use client";

import { Modal } from "@/components/ui/Modal";
import { usePollarAuth } from "@/hooks/usePollarAuth";

export function AccountModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user, logout } = usePollarAuth();

  if (!user) return null;

  return (
    <Modal open={open} onClose={onClose} title="Tu cuenta">
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-border bg-surface px-4 py-3.5">
          <p className="text-xs text-muted">Sesión</p>
          <p className="mt-0.5 truncate text-sm font-medium">
            {user.profile?.mail ?? "Conectado con Pollar"}
          </p>
        </div>
        <button
          onClick={() => {
            logout();
            onClose();
          }}
          className="w-full rounded-xl border border-error-border py-2.5 text-sm font-semibold text-error transition-colors hover:bg-error-light"
        >
          Cerrar sesión
        </button>
      </div>
    </Modal>
  );
}
