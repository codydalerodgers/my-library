// src/components/BarcodeScanner.tsx
import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';
import type { Result } from '@zxing/library';

interface BarcodeScannerProps {
  onDetected: (code: string) => void;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onDetected }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [ready, setReady] = useState(false);

  // ------------------------------------------------------
  // 1) Discover cameras
  // ------------------------------------------------------
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

        // Prefer a back/rear/environment camera if label exposes it
        const backIndex = inputs.findIndex((d) =>
          /back|rear|environment/i.test(d.label),
        );

        setDevices(inputs);
        setSelectedIndex(backIndex >= 0 ? backIndex : 0);
        setReady(true);
      } catch (e) {
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

  // ------------------------------------------------------
  // 2) Start/stop scanning when ready / device changes
  // ------------------------------------------------------
  useEffect(() => {
    if (!ready || !devices.length || !videoRef.current) return;

    const codeReader = new BrowserMultiFormatReader();
    let active = true;

    // Helper to stop via ZXing controls + stop any remaining tracks
    const stopScanner = () => {
      try {
        if (controlsRef.current) {
          controlsRef.current.stop();
        }
      } catch (err) {
        console.warn('Error stopping scanner controls:', err);
      } finally {
        controlsRef.current = null;
      }

      // Extra safety: clear video srcObject if present
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
        (
          result: Result | undefined,
          err: unknown,
          controls?: IScannerControls,
        ) => {
          if (!active) return;

          // Store controls so we can stop later (cleanup or after success)
          if (controls && !controlsRef.current) {
            controlsRef.current = controls;
          }

          // Ignore the "no code found yet" noise, only log real errors
          if (
            err &&
            (err as any).message &&
            !(err as any).message.includes(
              'No MultiFormat Readers were able to detect the code',
            )
          ) {
            console.warn('Scanner error:', err);
          }

          if (result) {
            const text = result.getText();
            active = false;

            // 🔻 Stop camera immediately via ZXing controls & tracks
            stopScanner();

            // Then notify parent
            onDetected(text);
          }
        },
      )
      .catch((err) => {
        if (!active) return;
        console.error(err);
        setError('Unable to start camera. Check permissions and try again.');
      });

    // Cleanup on unmount / device change
    return () => {
      active = false;
      stopScanner();
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