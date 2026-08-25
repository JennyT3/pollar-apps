"use client";

import { usePollar } from "@pollar/react";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import { useState } from "react";
import { useBalance } from "@/hooks/useBalance";
import { paymentAssetFrom } from "@/lib/payments";

export default function SpikePage() {
  const { user } = usePollarAuth();
  const pollar = usePollar();
  const { asset } = useBalance();
  
  const [status, setStatus] = useState<string>("idle");
  const [hash, setHash] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [recipient, setRecipient] = useState<string>("");

  const handlePayment = async () => {
    if (!recipient) {
      setErrorMsg("Please enter a recipient address");
      return;
    }
    
    setStatus("processing...");
    setErrorMsg("");
    setHash("");

    try {
      // Usar la firma confirmada en Fase 0
      const res = await pollar.getClient().runTx(
        "payment",
        {
          destination: recipient,
          amount: "1.00",
          asset: paymentAssetFrom(asset)
        },
        { memo: { type: "text", value: "spike-test" } }
      );
      
      setStatus(res.status);
      if (res.status === "success" && res.hash) {
        setHash(res.hash);
      }
      if (res.status === "error") {
        setErrorMsg(`${res.message || ""} ${res.details || ""}`);
      }
    } catch (e: any) {
      setStatus("error");
      setErrorMsg(e.message || "Unknown error");
    }
  };

  if (!user) {
    return (
      <div className="p-8">
        <p>Please log in first using the main page to test the spike.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Fase 0: Spike de Pago</h1>
      <p>Tu cuenta actual (contribuyente): <code className="bg-gray-100 p-1 rounded break-all">{user.address}</code></p>
      
      <div className="space-y-2">
        <label className="block text-sm font-medium">Cuenta destino (Organizador):</label>
        <input 
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="G..."
          className="w-full border p-2 rounded"
        />
      </div>

      <button 
        onClick={handlePayment}
        disabled={status === "processing..."}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        Ejecutar Pago (1.00 - spike-test)
      </button>

      {status !== "idle" && (
        <div className="mt-4 p-4 border rounded bg-gray-50">
          <p><strong>Status:</strong> {status}</p>
          {hash && (
            <p><strong>Hash:</strong> <code className="break-all">{hash}</code></p>
          )}
          {errorMsg && (
            <p className="text-red-600"><strong>Error:</strong> {errorMsg}</p>
          )}
        </div>
      )}
    </div>
  );
}
