import { useState, useEffect } from 'react';
import { matchService } from '../api/match.service';

export default function Home() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    matchService.getAllMatches()
      .then(res => {
        if (res.status === 'success') setMatches(res.data);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <h2 className="text-4xl font-bold mb-6 text-center">Cartelera de Partidos</h2>
      {loading ? (
        <p className="text-center text-gray-400">Cargando partidos...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {matches.map(m => (
            <div key={m.id} className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
              <span className="text-xs bg-emerald-900 text-emerald-300 px-2 py-1 rounded-full uppercase">{m.status}</span>
              <h3 className="text-xl font-bold mt-2">{m.opponent}</h3>
              <p className="text-sm text-gray-400 mt-1">{m.stadium_name}</p>
              <p className="text-xs text-gray-400 mt-1">{new Date(m.match_date).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}