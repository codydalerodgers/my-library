// src/components/BarcodeScanner.tsx
import { useEffect, useRef, useState } from 'react';
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
  const [ready, setReady] = useState(false);

  // ------------------------------------------------------
  // 1) Discover cameras and pick a sensible default
  // ------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Trigger permission prompt so enumerateDevices returns labels
        await navigator.mediaDevices.getUserMedia({ video: true });

        const all = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) return;

        const inputs = all.filter((d) => d.kind === 'videoinput');
        if (!inputs.length) {
          setError('No camera devices found.');
          return;
        }

        setDevices(inputs);

        // Prefer a "back" / "rear" / "environment" camera if present
        const backIndex = inputs.findIndex((d) =>
          /back|rear|environment/i.test(d.label),
        );
        setSelectedIndex(backIndex >= 0 ? backIndex : 0);
        setReady(true);
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          setError('Unable to access camera.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ------------------------------------------------------
  // 2) Start/stop scanning when ready / device changes
  // ------------------------------------------------------
  useEffect(() => {
    if (!ready || !videoRef.current || !devices.length) return;

    const codeReader = new BrowserMultiFormatReader();
    let active = true;

    const stopStream = () => {
      try {
        // Ask zxing to stop if it exposes reset
        (codeReader as any)?.reset?.();
      } catch (err) {
        console.warn('codeReader.reset() failed', err);
      }

      const video = videoRef.current;
      if (video && video.srcObject instanceof MediaStream) {
        const stream = video.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
        video.srcObject = null;
      }
    };

    const device = devices[selectedIndex];
    const deviceId = device?.deviceId || undefined;

    codeReader
      .decodeFromVideoDevice(
        deviceId,
        videoRef.current,
        (result: Result | undefined, _err) => {
          if (!active) return;
          if (result) {
            active = false;
            const text = result.getText();

            // 🔻 Stop camera immediately BEFORE notifying parent
            // so that even if onDetected changes view, Safari sees tracks closed.
            stopStream();
            onDetected(text);
          }
        },
      )
      .catch((err) => {
        if (!active) return;
        console.error(err);
        setError('Unable to start camera.');
      });

    // Cleanup on unmount / device change / tab switch
    return () => {
      active = false;
      stopStream();
    };
  }, [ready, devices, selectedIndex, onDetected]);

  // ------------------------------------------------------
  // 3) Flip camera
  // ------------------------------------------------------
  const handleFlipCamera = () => {
    if (!devices.length) return;
    setSelectedIndex((prev) => (prev + 1) % devices.length);
  };

  // ------------------------------------------------------
  // 4) Render
  // ------------------------------------------------------
  if (error) {
    return (
      <div className="scanner-shell">
        <p className="muted">{error}</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="scanner-shell">
        <p className="muted">Initializing camera…</p>
      </div>
    );
  }

  return (
    <div className="scanner-shell">
      <div className="scanner-header-row">
        <div className="scanner-label">Live camera</div>
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

      <div className="scanner-frame">
        <video ref={videoRef} className="scanner-video" />
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