const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./src/routes/auth.routes');
const matchRoutes = require('./src/routes/match.routes');
const ticketRoutes = require('./src/routes/ticket.routes');
const productoRoutes = require('./src/routes/producto.routes');
const orderRoutes = require('./src/routes/order.routes');
const membershipRoutes = require('./src/routes/membership.routes');
const tenantRoutes = require('./src/routes/tenant.routes');
const userRoutes = require('./src/routes/user.routes');
const zoneRoutes = require('./src/routes/zone.routes');
const associationRoutes = require('./src/routes/association.routes');
const clubRequestRoutes = require('./src/routes/clubRequest.routes');

const app = express();
const PORT = process.env.PORT || 3000;


app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Bienvenido a Tribuna 360');
});

app.get('/info', (req, res) => {
    res.send('Sistema web para la gestión de entradas y su tienda de productos deportivos y administración de socios.');
});

app.get('/contacto', (req, res) => {
    res.send('Contacto: soporte@sistemadeportivo.com | Teléfono: +591 62988469');
});

app.get('/entradas', (req, res) => {
    res.send('Módulo de venta y gestión de entradas para partidos de fútbol');
});

app.get('/api', (req, res) => {
    res.json({
        nombre: "Tribuna 360",
        version: "1.0.0",
        autor: "Jairo Nilson Escalier Mamani"
    });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/matches', matchRoutes);
app.use('/api/v1/tickets', ticketRoutes);
app.use('/api/v1/productos', productoRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/memberships', membershipRoutes);
app.use('/api/v1/tenants', tenantRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/zones', zoneRoutes);
app.use('/api/v1/associations', associationRoutes);
app.use('/api/v1/club-requests', clubRequestRoutes);
app.listen(PORT, () => {
  console.log(`Servidor backend ejecutándose en http://localhost:${PORT}`);
});