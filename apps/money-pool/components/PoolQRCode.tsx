"use client";

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface PoolQRCodeProps {
  mode: 'share' | 'contribute';
  poolId: string;
  baseUrl?: string;
  amount?: string;
  size?: number;
}

export function PoolQRCode({ mode, poolId, baseUrl, amount, size = 200 }: PoolQRCodeProps) {
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
    return <div style={{ width: size, height: size }} className="bg-gray-100 animate-pulse rounded-md m-4"></div>;
  }

  let url = `${currentBaseUrl}/pool/${poolId}`;
  if (mode === 'contribute') {
    url += `/contribute`;
    if (amount) {
      url += `?amount=${encodeURIComponent(amount)}`;
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100">
        <QRCodeSVG value={url} size={size} />
      </div>
    </div>
  );
}
