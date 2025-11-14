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
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [initialised, setInitialised] = useState(false);

  // Discover cameras
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const inputs = await BrowserMultiFormatReader.listVideoInputDevices();
        if (!mounted) return;

        if (!inputs.length) {
          setError('No camera found on this device.');
          return;
        }

        // Prefer a back/rear/environment camera if the label exposes it
        const backIndex = inputs.findIndex((d) =>
          /back|rear|environment/i.test(d.label),
        );

        setDevices(inputs);
        setSelectedIndex(backIndex >= 0 ? backIndex : 0);
        setInitialised(true);
      } catch (e: any) {
        console.error(e);
        if (mounted) {
          setError('Unable to access camera devices.');
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Start scanning whenever selectedIndex or devices change
  useEffect(() => {
    if (!initialised || !devices.length || !videoRef.current) return;

    const codeReader = new BrowserMultiFormatReader();
    let isMounted = true;
    let handled = false;

    (async () => {
      try {
        const device = devices[selectedIndex];
        // Some environments return an empty deviceId but still work if we pass undefined
        const deviceId = device?.deviceId || undefined;

        await codeReader.decodeFromVideoDevice(
          deviceId,
          videoRef.current!,
          (result: Result | undefined) => {
            if (!isMounted || handled) return;
            if (result) {
              handled = true;
              const text = result.getText();
              onDetected(text);
              // We don't call reset(); we just ignore further results
            }
          },
        );
      } catch (e: any) {
        console.error(e);
        if (isMounted) {
          setError('Unable to start camera. Check permissions and try again.');
        }
      }
    })();

    return () => {
      isMounted = false;
      try {
        const stream = videoRef.current?.srcObject as MediaStream | null;
        stream?.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore cleanup errors
      }
    };
  }, [devices, selectedIndex, initialised, onDetected]);

  const handleFlipCamera = () => {
    if (!devices.length) return;
    setSelectedIndex((prev) => (prev + 1) % devices.length);
  };

  return (
    <div className="scanner-shell">
      <div className="scanner-header-row">
        <span className="muted scanner-label">
          Camera {devices.length > 1 ? `(${selectedIndex + 1}/${devices.length})` : ''}
        </span>
        {devices.length > 1 && (
          <button
            type="button"
            className="secondary small"
            onClick={handleFlipCamera}
          >
            Flip camera
          </button>
        )}
      </div>

      {error && (
        <div style={{ color: 'red', marginBottom: '0.5rem' }}>
          {error}
        </div>
      )}

      <div className="scanner-frame">
        <video
          ref={videoRef}
          className="scanner-video"
        />
        <div className="scanner-overlay">
          <div className="scanner-box" />
        </div>
      </div>

      <div className="muted" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
        Align the barcode inside the box. The scan will trigger automatically.
      </div>
    </div>
  );
};