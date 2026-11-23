import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, Keyboard, XCircle } from 'lucide-react';
import { useAuth } from '../context/auth-context';
import { ticketService } from '../api/ticket.service';
import {
  getOfflineMatches,
  getOfflineScanStats,
  getPendingOfflineScans,
  recordOfflineScan,
  saveOfflineManifest,
  updateOfflineScanResults,
} from '../api/offlineTicketStore';

export default function Scanner() {
  const { user } = useAuth();
  const tenantId = user?.tenant_id;
  const userRole = user?.role;
  const [mode, setMode] = useState('camera');
  const [qrCode, setQrCode] = useState('');
  const [result, setResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [matches, setMatches] = useState([]);
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [offlineStats, setOfflineStats] = useState({ pending: 0, synced: 0, conflict: 0, invalid: 0 });
  const [downloading, setDownloading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineMessage, setOfflineMessage] = useState('');

  const videoRef = useRef(null);
  const inputRef = useRef(null);
  const streamRef = useRef(null);
  const syncingRef = useRef(false);
  const processingRef = useRef(false);
  const selectedMatchIdRef = useRef(selectedMatchId);
  const syncPendingScansRef = useRef(null);

  const playSound = useCallback((type) => {
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
    } catch (error) {
      console.debug('[Scanner] No se pudo reproducir la señal de audio:', error);
    }
  }, []);

  const refreshOfflineStats = useCallback(async (matchId = selectedMatchId) => {
    if (!matchId) return;
    try {
      setOfflineStats(await getOfflineScanStats(matchId));
    } catch (error) {
      setOfflineMessage(error.message);
    }
  }, [selectedMatchId]);

  const syncPendingScans = useCallback(async (matchIds = selectedMatchId ? [selectedMatchId] : []) => {
    if (!navigator.onLine || syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const allMatches = matchIds.length
        ? matchIds
        : (await getOfflineMatches(tenantId, userRole === 'superadmin')).map((match) => match.id);
      let totalSynced = 0;
      let totalConflicts = 0;
      for (const matchId of allMatches) {
        const pending = await getPendingOfflineScans(matchId);
        for (let offset = 0; offset < pending.length; offset += 100) {
          const batch = pending.slice(offset, offset + 100);
          const response = await ticketService.syncOfflineScans(
            matchId,
            batch.map(({ client_scan_id, qr_code }) => ({ client_scan_id, qr_code }))
          );
          if (!Array.isArray(response.data)) {
            throw new Error('El servidor devolvió una respuesta de sincronización inválida.');
          }
          await updateOfflineScanResults(response.data);
          totalSynced += response.data.filter((scan) => scan.status === 'synced').length;
          totalConflicts += response.data.filter(
            (scan) => scan.status === 'conflict' || scan.status === 'invalid'
          ).length;
        }
      }
      await refreshOfflineStats();
      if (totalSynced || totalConflicts) {
        setOfflineMessage(
          `Sincronización completada: ${totalSynced} aceptada(s), ${totalConflicts} conflicto(s) o inválida(s).`
        );
      }
    } catch (error) {
      setOfflineMessage(error.message);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [refreshOfflineStats, selectedMatchId, tenantId, userRole]);
  useEffect(() => {
    syncPendingScansRef.current = syncPendingScans;
  }, [syncPendingScans]);

  useEffect(() => {
    selectedMatchIdRef.current = selectedMatchId;
  }, [selectedMatchId]);

  useEffect(() => {
    let active = true;
    const loadMatches = async () => {
      let cached = [];
      try {
        cached = await getOfflineMatches(tenantId, userRole === 'superadmin');
      } catch (error) {
        if (active) setOfflineMessage(error.message);
      }

      if (active) {
        setMatches(cached);
        setSelectedMatchId((current) => current || cached[0]?.id || '');
      }

      if (!navigator.onLine) return;
      try {
        const response = await ticketService.getOfflineMatches();
        if (active) {
          const byId = new Map(cached.map((match) => [match.id, match]));
          for (const match of response.data || []) {
            byId.set(match.id, { ...byId.get(match.id), ...match });
          }
          const availableMatches = Array.from(byId.values());
          setMatches(availableMatches);
          setSelectedMatchId((current) => current || availableMatches[0]?.id || '');
        }
      } catch (error) {
        if (active) setOfflineMessage(error.message);
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      void loadMatches();
      void syncPendingScansRef.current?.([]);
    };
    const handleOffline = () => setIsOnline(false);

    void loadMatches();
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      active = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [tenantId, userRole]);

  useEffect(() => {
    if (!selectedMatchId) return;
    let active = true;
    getOfflineScanStats(selectedMatchId)
      .then((stats) => {
        if (active) setOfflineStats(stats);
      })
      .catch((error) => {
        if (active) setOfflineMessage(error.message);
      });
    return () => { active = false; };
  }, [selectedMatchId]);

  const processCode = useCallback(async (code) => {
    const trimmed = code.trim();
    if (!trimmed || processingRef.current) return;

    processingRef.current = true;
    setScanning(true);
    setResult(null);
    const matchId = selectedMatchIdRef.current;

    if (!navigator.onLine) {
      if (!matchId) {
        playSound('error');
        setResult({ ok: false, message: 'Selecciona un partido descargado para validar sin conexión.' });
        processingRef.current = false;
        setScanning(false);
        setQrCode('');
        return;
      }
      try {
        const localResult = await recordOfflineScan(matchId, trimmed);
        playSound(localResult.ok ? 'success' : 'error');
        setResult({ ...localResult, offlineLocal: localResult.ok });
        await refreshOfflineStats(matchId);
      } catch (error) {
        playSound('error');
        setResult({ ok: false, message: error.message });
      } finally {
        processingRef.current = false;
        setScanning(false);
        setQrCode('');
      }
      return;
    }

    try {
      const data = await ticketService.scanTicket(trimmed);
      playSound('success');
      setResult({ ok: true, message: data.message, ticket: data.ticket });
    } catch (error) {
      if (error instanceof TypeError && matchId) {
        try {
          const localResult = await recordOfflineScan(matchId, trimmed);
          playSound(localResult.ok ? 'success' : 'error');
          setResult({ ...localResult, offlineLocal: localResult.ok });
          await refreshOfflineStats(matchId);
        } catch (offlineError) {
          playSound('error');
          setResult({ ok: false, message: offlineError.message });
        }
      } else {
        playSound('error');
        setResult({ ok: false, message: error.message });
      }
    } finally {
      processingRef.current = false;
      setScanning(false);
      setQrCode('');
    }
  }, [playSound, refreshOfflineStats]);

  const downloadOfflineData = async () => {
    if (!selectedMatchId || downloading) return;
    setDownloading(true);
    setOfflineMessage('');
    try {
      const response = await ticketService.getOfflineManifest(selectedMatchId);
      const count = await saveOfflineManifest(response.data);
      setMatches((current) => {
        const next = new Map(current.map((match) => [match.id, match]));
        next.set(response.data.match.id, {
          ...response.data.match,
          downloaded_at: response.data.downloaded_at,
        });
        return Array.from(next.values());
      });
      setOfflineMessage(`${count} entrada(s) descargadas para ${response.data.match.opponent}.`);
    } catch (error) {
      setOfflineMessage(error.message);
    } finally {
      setDownloading(false);
    }
  };

  const handleManualSubmit = (event) => {
    event.preventDefault();
    void processCode(qrCode);
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Cámara no disponible.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (error) {
      console.debug('[Scanner] Cámara no disponible:', error);
      setCameraError('Cámara no disponible. Use ingreso por código o pistola láser.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (mode !== 'camera') return undefined;
    const scheduled = window.setTimeout(() => { void startCamera(); }, 0);
    return () => {
      window.clearTimeout(scheduled);
      stopCamera();
    };
  }, [mode]);

  useEffect(() => {
    if (!cameraActive || mode !== 'camera') return;
    let animationFrameId;
    let detector = null;
    let lastCameraCode = null;
    if ('BarcodeDetector' in window) {
      try {
        detector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128'] });
      } catch (error) {
        console.debug('[Scanner] BarcodeDetector no disponible:', error);
      }
    }
    const scanFrame = async () => {
      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA && detector) {
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length > 0 && barcodes[0].rawValue) {
            const code = barcodes[0].rawValue;
            if (code !== lastCameraCode) {
              lastCameraCode = code;
              void processCode(code);
            }
          } else {
            lastCameraCode = null;
          }
        } catch (error) {
          console.debug('[Scanner] No se pudo analizar el fotograma:', error);
        }
      }
      animationFrameId = requestAnimationFrame(scanFrame);
    };
    if (detector) animationFrameId = requestAnimationFrame(scanFrame);
    return () => { if (animationFrameId) cancelAnimationFrame(animationFrameId); };
  }, [cameraActive, mode, processCode]);

  return (
    <div className="max-w-xl mx-auto px-6 py-12">
      <div className="card p-8 md:p-10 border border-slate-700 shadow-2xl text-center">
        <h2 className="section-title text-2xl md:text-3xl mb-2">Validador de Accesos</h2>
        <p className="text-slate-400 text-sm mb-6">Escanea el código QR del boleto en el torniquete.</p>

        <section className="text-left space-y-3 mb-6 rounded-xl border border-slate-700 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className={isOnline ? 'text-emerald-300' : 'text-amber-300'}>
              {isOnline ? 'Con conexión' : 'Sin conexión — validación local'}
            </span>
            <span className="text-slate-400">
              Pendientes: {offlineStats.pending} · Conflictos: {offlineStats.conflict + offlineStats.invalid}
            </span>
          </div>
          <label htmlFor="offline-match" className="block text-xs font-semibold text-slate-300">
            Partido para preparar el modo offline
          </label>
          <select
            id="offline-match"
            value={selectedMatchId}
            onChange={(event) => setSelectedMatchId(event.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white"
          >
            <option value="">Selecciona un partido</option>
            {matches.map((match) => (
              <option key={match.id} value={match.id}>
                {match.opponent} — {new Date(match.match_date).toLocaleString('es-BO')}
                {match.downloaded_at ? ' · descargado' : ''}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void downloadOfflineData()}
              disabled={!isOnline || !selectedMatchId || downloading}
              className="btn btn-primary px-4 py-2 text-xs font-bold disabled:opacity-50"
            >
              {downloading ? 'Descargando...' : 'Descargar entradas del partido'}
            </button>
            <button
              type="button"
              onClick={() => void syncPendingScans()}
              disabled={!isOnline || !offlineStats.pending || syncing}
              className="rounded-xl border border-slate-600 px-4 py-2 text-xs font-bold text-slate-200 disabled:opacity-50"
            >
              {syncing ? 'Sincronizando...' : 'Sincronizar pendientes'}
            </button>
          </div>
          <p className="text-[11px] leading-relaxed text-amber-200/90">
            Offline: solo se valida contra datos descargados y se bloquean reusos en este dispositivo.
            Otro escáner desconectado podría aceptar el mismo boleto; los conflictos se detectan al sincronizar.
          </p>
          {offlineMessage && <p role="status" className="text-xs text-slate-300">{offlineMessage}</p>}
        </section>

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
              onChange={(event) => setQrCode(event.target.value)}
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
                <p className="font-display font-extrabold text-lg tracking-wide">
                  {result.offlineLocal
                    ? 'ACCESO LOCAL — PENDIENTE DE SINCRONIZAR'
                    : result.ok ? 'ACCESO PERMITIDO' : 'ACCESO DENEGADO'}
                </p>
                <p className="text-sm mt-0.5 font-medium">{result.message}</p>
                {result.ticket && (
                  <p className="text-xs mt-2 text-emerald-300 font-semibold border-t border-emerald-800/60 pt-2">
                    {result.ticket.matches?.opponent || matches.find((match) => match.id === selectedMatchId)?.opponent}
                    {' · '}{result.ticket.zones?.name}
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
