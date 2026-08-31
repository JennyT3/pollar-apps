"use client";

import { useState, useEffect } from 'react';
import { Button } from './ui/Button';

export function ShareButton({ title, path }: { title: string; path: string }) {
  const [isShareSupported, setIsShareSupported] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsShareSupported(typeof navigator !== 'undefined' && !!navigator.share);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? `${window.location.origin}${path}` : '';
    if (!url) return;

    if (isShareSupported) {
      try {
        await navigator.share({
          title,
          url,
        });
        return;
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Error sharing', err);
        }
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Error copying to clipboard', err);
    }
  };

  return (
    <Button onClick={handleShare} variant="secondary" className="w-full">
      {copied ? '¡Enlace copiado!' : (isShareSupported ? 'Compartir enlace' : 'Copiar enlace')}
    </Button>
  );
}
