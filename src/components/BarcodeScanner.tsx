// src/components/BarcodeScanner.tsx
import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import type { Result } from '@zxing/library';

interface BarcodeScannerProps {
  onDetected: (code: string) => void;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onDetected }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Use any so we can safely call .reset() without TS complaining
    const codeReader: any = new BrowserMultiFormatReader();
    let isMounted = true;

    (async () => {
      try {
        const videoInputDevices = await BrowserMultiFormatReader.listVideoInputDevices();
        const deviceId = videoInputDevices[0]?.deviceId;

        await codeReader.decodeFromVideoDevice(
          deviceId ?? undefined, // avoid passing null
          videoRef.current!,
          (result: Result | undefined) => {
            if (!isMounted) return;
            if (result) {
              const text = result.getText();
              onDetected(text);
              // stop scanning after first result
              codeReader.reset();
            }
          },
        );
      } catch (e: any) {
        console.error(e);
        setError('Unable to access camera. Check permissions.');
      }
    })();

    return () => {
      isMounted = false;
      codeReader.reset();
    };
  }, [onDetected]);

  return (
    <div>
      {error && (
        <div style={{ color: 'red', marginBottom: '0.5rem' }}>
          {error}
        </div>
      )}
      <video
        ref={videoRef}
        style={{
          width: '100%',
          maxHeight: '400px',
          borderRadius: '0.5rem',
          background: '#000',
        }}
      />
      <div style={{ fontSize: '0.8rem', marginTop: '0.5rem', color: '#6b7280' }}>
        Align the book barcode within the frame.
      </div>
    </div>
  );
};