import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Scanner from './pages/Scanner';
import AdminDashboard from './pages/AdminDashboard';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="bg-gray-900 text-gray-100 min-h-screen flex flex-col justify-between">
          <Navbar />
          <main className="flex-grow">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/scanner" element={<Scanner />} />
              <Route path="/admin" element={<AdminDashboard />} />
            </Routes>
          </main>
          <footer className="bg-gray-800 border-t border-gray-700 py-4 text-center text-gray-400 text-sm">
            &copy; 2026 Tribuna 360 - Tesis de Ingeniería de Software
          </footer>
        </div>
      </Router>
    </AuthProvider>
  );
}