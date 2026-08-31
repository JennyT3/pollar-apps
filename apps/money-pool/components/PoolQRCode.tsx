"use client";

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface PoolQRCodeProps {
  mode: 'share' | 'contribute';
  poolId: string;
  baseUrl?: string;
  amount?: string;
}

export function PoolQRCode({ mode, poolId, baseUrl, amount }: PoolQRCodeProps) {
  const [currentBaseUrl, setCurrentBaseUrl] = useState(baseUrl || '');

  useEffect(() => {
    if (!currentBaseUrl) {
      const timer = setTimeout(() => {
        if (typeof window !== 'undefined') setCurrentBaseUrl(window.location.origin);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [currentBaseUrl]);

  if (!currentBaseUrl) {
    return <div className="w-32 md:w-40 aspect-square bg-muted/20 animate-pulse rounded-xl m-4"></div>;
  }

  let url = `${currentBaseUrl}/pool/${poolId}`;
  if (mode === 'contribute') {
    url += `/contribute`;
    if (amount) {
      url += `?amount=${encodeURIComponent(amount)}`;
    }
  }

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <div className="w-32 md:w-40 aspect-square bg-white p-3 rounded-xl flex items-center justify-center">
        <QRCodeSVG
          value={url}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    </div>
  );
}
