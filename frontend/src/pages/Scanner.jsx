import { useState } from 'react';
import { ticketService } from '../api/ticket.service';

export default function Scanner() {
  const [qrCode, setQrCode] = useState('');
  const [result, setResult] = useState(null);

  const handleScan = async (e) => {
    e.preventDefault();
    try {
      const data = await ticketService.scanTicket(qrCode.trim());
      setResult({ ok: true, message: data.message });
    } catch (err) {
      setResult({ ok: false, message: err.message });
    }
    setQrCode('');
  };

  return (
    <div className="max-w-xl mx-auto px-6 py-16">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 shadow-xl text-center">
        <h2 className="text-2xl font-bold mb-4">Validador de Entradas (QR)</h2>
        <form onSubmit={handleScan} className="space-y-4">
          <input 
            type="text" 
            value={qrCode} 
            onChange={(e) => setQrCode(e.target.value)} 
            placeholder="TRIBUNA360-..." 
            required 
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white" 
          />
          <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 rounded-lg transition">
            Verificar Ingreso
          </button>
        </form>

        {result && (
          <div className={`mt-6 p-4 rounded-xl border ${result.ok ? 'bg-emerald-950 border-emerald-700 text-emerald-300' : 'bg-red-950 border-red-700 text-red-300'}`}>
            <p className="font-bold">{result.ok ? '✅ ACCESO PERMITIDO' : '❌ ACCESO DENEGADO'}</p>
            <p className="text-sm mt-1">{result.message}</p>
          </div>
        )}
      </div>
    </div>
  );
}