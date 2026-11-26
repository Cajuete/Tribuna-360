import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ROUTE_ROLES } from './config/roles';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import FanOnlyRoute from './components/FanOnlyRoute';
import Home from './pages/Home';
import Scanner from './pages/Scanner';
import AdminDashboard from './pages/AdminDashboard';
import SalesManagerDashboard from './pages/SalesManagerDashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import BuyTickets from './pages/BuyTickets';
import MyTickets from './pages/MyTickets';
import Tienda from './pages/Tienda';
import Cart from './pages/Cart';
import Club from './pages/Club';
import Matches from './pages/Matches';
import MyOrders from './pages/MyOrders';
import Socios from './pages/Socios';
import MyMembership from './pages/MyMembership';
import MyProfile from './pages/MyProfile';
import MyHistory from './pages/MyHistory';
import Unete from './pages/Unete';
import OlvideContrasena from './pages/OlvideContrasena';
import Restablecer from './pages/Restablecer';
import PaymentCheckout from './pages/PaymentCheckout';
import MyPayments from './pages/MyPayments';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <CartProvider>
          <div className="app-shell min-h-screen flex flex-col justify-between">
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
                <Route path="/club/:slug/partidos" element={<Matches />} />
                <Route path="/partidos" element={<Matches />} />
                <Route path="/comprar/:matchId" element={
                  <FanOnlyRoute allowGuest><BuyTickets /></FanOnlyRoute>
                } />
                <Route path="/tienda" element={<Tienda />} />
                <Route path="/carrito" element={
                  <FanOnlyRoute allowGuest><Cart /></FanOnlyRoute>
                } />
                <Route path="/pagar/:paymentId" element={
                  <FanOnlyRoute><PaymentCheckout /></FanOnlyRoute>
                } />
                <Route path="/mis-pagos" element={
                  <FanOnlyRoute><MyPayments /></FanOnlyRoute>
                } />
                <Route path="/socios" element={<Socios />} />
                <Route path="/mis-socio" element={
                  <FanOnlyRoute><MyMembership /></FanOnlyRoute>
                } />
                <Route path="/mi-historial" element={
                  <FanOnlyRoute><MyHistory /></FanOnlyRoute>
                } />
                <Route path="/mi-perfil" element={
                  <ProtectedRoute><MyProfile /></ProtectedRoute>
                } />
                <Route path="/mis-entradas" element={
                  <FanOnlyRoute><MyTickets /></FanOnlyRoute>
                } />
                <Route path="/mis-pedidos" element={
                  <FanOnlyRoute><MyOrders /></FanOnlyRoute>
                } />
                <Route
                  path="/scanner"
                  element={
                    <ProtectedRoute roles={ROUTE_ROLES.scanner}>
                      <Scanner />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/ventas"
                  element={
                    <ProtectedRoute roles={ROUTE_ROLES.ventas}>
                      <SalesManagerDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute roles={ROUTE_ROLES.admin}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </main>
            <Footer />
          </div>
        </CartProvider>
      </Router>
    </AuthProvider>
  );
}