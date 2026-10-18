import { useState } from 'react';
import { matchService } from '../api/match.service';

export default function AdminDashboard() {
  const [form, setForm] = useState({ tenant_id: '', opponent: '', match_date: '', stadium_name: 'Estadio Hernando Siles' });
  const [message, setMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await matchService.createMatch(form);
      setMessage({ ok: true, text: '¡Partido creado y publicado con éxito!' });
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h2 className="text-3xl font-bold mb-6">Panel de Administración</h2>
      <form onSubmit={handleSubmit} className="bg-gray-800 p-6 rounded-2xl border border-gray-700 space-y-4">
        <input type="text" placeholder="ID del Club (Tenant UUID)" value={form.tenant_id} onChange={e => setForm({...form, tenant_id: e.target.value})} required className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white" />
        <input type="text" placeholder="Rival" value={form.opponent} onChange={e => setForm({...form, opponent: e.target.value})} required className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white" />
        <input type="datetime-local" value={form.match_date} onChange={e => setForm({...form, match_date: e.target.value})} required className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white" />
        <input type="text" placeholder="Estadio" value={form.stadium_name} onChange={e => setForm({...form, stadium_name: e.target.value})} required className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white" />
        <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 rounded-lg">Guardar Partido</button>
      </form>
      {message && <p className={`mt-4 p-3 rounded text-center ${message.ok ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-300'}`}>{message.text}</p>}
    </div>
  );
}