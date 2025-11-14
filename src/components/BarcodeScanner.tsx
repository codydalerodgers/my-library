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
    const codeReader = new BrowserMultiFormatReader();
    let isMounted = true;
    let handled = false;

    (async () => {
      try {
        const videoInputDevices = await BrowserMultiFormatReader.listVideoInputDevices();
        const deviceId = videoInputDevices[0]?.deviceId;

        await codeReader.decodeFromVideoDevice(
          deviceId ?? undefined,
          videoRef.current!,
          (result: Result | undefined) => {
            if (!isMounted || handled) return;
            if (result) {
              handled = true;
              const text = result.getText();
              onDetected(text);
              // NOTE: we do NOT call codeReader.reset() here,
              // since some versions of @zxing/browser don't expose it.
              // We just ignore any further results.
            }
          },
        );
      } catch (e: any) {
        console.error(e);
        if (isMounted) {
          setError('Unable to access camera. Check permissions and try again.');
        }
      }
    })();

    return () => {
      // mark unmounted so callback stops doing anything
      isMounted = false;
      // we also don't call reset here to avoid the runtime error
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