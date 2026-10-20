import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Scanner from './pages/Scanner';
import AdminDashboard from './pages/AdminDashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import BuyTickets from './pages/BuyTickets';
import MyTickets from './pages/MyTickets';
import Tienda from './pages/Tienda';
import Club from './pages/Club';
import MyOrders from './pages/MyOrders';
import Socios from './pages/Socios';
import MyMembership from './pages/MyMembership';
import Unete from './pages/Unete';
import OlvideContrasena from './pages/OlvideContrasena';
import Restablecer from './pages/Restablecer';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="bg-gray-900 text-gray-100 min-h-screen flex flex-col justify-between">
          <Navbar />
          <main className="flex-grow">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/registro" element={<Register />} />
              <Route path="/olvide-contrasena" element={<OlvideContrasena />} />
              <Route path="/restablecer" element={<Restablecer />} />
              <Route path="/unete" element={<Unete />} />
              <Route path="/club/:slug" element={<Club />} />
              <Route path="/comprar/:matchId" element={<BuyTickets />} />
              <Route path="/tienda" element={<Tienda />} />
              <Route path="/socios" element={<Socios />} />
              <Route path="/mis-socio" element={
                <ProtectedRoute><MyMembership /></ProtectedRoute>
              } />
              <Route path="/mis-entradas" element={
                <ProtectedRoute><MyTickets /></ProtectedRoute>
              } />
              <Route path="/mis-pedidos" element={
                <ProtectedRoute><MyOrders /></ProtectedRoute>
              } />
              <Route
                path="/scanner"
                element={
                  <ProtectedRoute roles={['superadmin', 'gate_operator']}>
                    <Scanner />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute roles={['superadmin', 'club_admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </main>
          <Footer />
        </div>
      </Router>
    </AuthProvider>
  );
}