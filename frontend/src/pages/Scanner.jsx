import { useState, useRef, useEffect } from 'react';
import { Camera, CheckCircle2, XCircle, QrCode, Keyboard } from 'lucide-react';
import { ticketService } from '../api/ticket.service';

export default function Scanner() {
  const [mode, setMode] = useState('camera');
  const [qrCode, setQrCode] = useState('');
  const [result, setResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  
  const videoRef = useRef(null);
  const inputRef = useRef(null);
  const streamRef = useRef(null);

  const playSound = (type) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type === 'success' ? 'sine' : 'sawtooth';
      osc.frequency.setValueAtTime(type === 'success' ? 880 : 220, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + (type === 'success' ? 0.25 : 0.4));
    } catch {}
  };

  const processCode = async (code) => {
    const trimmed = code.trim();
    if (!trimmed || scanning) return;

    setScanning(true);
    setResult(null);

    try {
      const data = await ticketService.scanTicket(trimmed);
      playSound('success');
      setResult({ ok: true, message: data.message, ticket: data.ticket });
    } catch (err) {
      playSound('error');
      setResult({ ok: false, message: err.message });
    } finally {
      setScanning(false);
      setQrCode('');
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    processCode(qrCode);
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      setCameraError('Cámara no disponible. Use ingreso por código o pistola láser.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (mode === 'camera') startCamera();
    else stopCamera();
    return () => stopCamera();
  }, [mode]);

  useEffect(() => {
    if (!cameraActive || mode !== 'camera') return;
    let animationFrameId;
    let detector = null;
    if ('BarcodeDetector' in window) {
      try {
        detector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128'] });
      } catch {}
    }
    const scanFrame = async () => {
      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA && detector) {
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length > 0 && barcodes[0].rawValue) {
            processCode(barcodes[0].rawValue);
            return;
          }
        } catch {}
      }
      animationFrameId = requestAnimationFrame(scanFrame);
    };
    if (detector) animationFrameId = requestAnimationFrame(scanFrame);
    return () => { if (animationFrameId) cancelAnimationFrame(animationFrameId); };
  }, [cameraActive, mode]);

  return (
    <div className="max-w-xl mx-auto px-6 py-12">
      <div className="card p-8 md:p-10 border border-slate-700 shadow-2xl text-center">
        <h2 className="section-title text-2xl md:text-3xl mb-2">Validador de Accesos</h2>
        <p className="text-slate-400 text-sm mb-6">Escanea el código QR del boleto en el torniquete.</p>

        <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-950 border border-slate-800 rounded-2xl mb-6">
          <button
            type="button"
            onClick={() => setMode('camera')}
            className={`py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition ${
              mode === 'camera' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Camera className="w-4 h-4" /> Cámara
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition ${
              mode === 'manual' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Keyboard className="w-4 h-4" /> Código / Láser
          </button>
        </div>

        {mode === 'camera' ? (
          <div className="relative h-64 rounded-2xl bg-slate-950 border-2 border-slate-700 flex flex-col items-center justify-center p-2 mb-6 overflow-hidden">
            {cameraError ? (
              <p className="text-xs text-red-400 font-semibold p-4">{cameraError}</p>
            ) : (
              <>
                <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute w-40 h-40 border-2 border-emerald-400 rounded-2xl pointer-events-none shadow-[0_0_30px_rgba(16,185,129,0.4)] animate-pulse" />
              </>
            )}
          </div>
        ) : (
          <form onSubmit={handleManualSubmit} className="space-y-4 mb-6">
            <input
              ref={inputRef}
              type="text"
              value={qrCode}
              onChange={(e) => setQrCode(e.target.value)}
              placeholder="TRIBUNA360-..."
              required
              autoFocus
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3.5 text-white font-mono font-bold text-center tracking-wider outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={scanning}
              className="btn btn-primary w-full py-3.5 text-base font-bold uppercase tracking-wider shadow-lg disabled:opacity-50"
            >
              {scanning ? 'Verificando...' : 'Verificar Acceso'}
            </button>
          </form>
        )}

        {result && (
          <div className={`p-5 rounded-2xl border transition-all animate-in zoom-in-95 duration-200 ${
            result.ok
              ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200 shadow-[0_0_40px_rgba(16,185,129,0.3)]'
              : 'bg-red-950/90 border-red-500 text-red-200 shadow-[0_0_40px_rgba(239,68,68,0.3)]'
          }`}>
            <div className="flex items-center justify-center gap-3">
              {result.ok ? <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" /> : <XCircle className="w-8 h-8 text-red-400 shrink-0" />}
              <div className="text-left">
                <p className="font-display font-extrabold text-lg tracking-wide">{result.ok ? 'ACCESO PERMITIDO' : 'ACCESO DENEGADO'}</p>
                <p className="text-sm mt-0.5 font-medium">{result.message}</p>
                {result.ticket && (
                  <p className="text-xs mt-2 text-emerald-300 font-semibold border-t border-emerald-800/60 pt-2">
                    {result.ticket.matches?.opponent} &middot; {result.ticket.zones?.name}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
