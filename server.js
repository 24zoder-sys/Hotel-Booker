const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { db } = require('./database/db');
const roomRoutes = require('./routes/rooms');
const bookingRoutes = require('./routes/bookings');
const statRoutes = require('./routes/stats');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// Request logging for API endpoints
app.use('/api', (req, res, next) => {
  console.log(`[API ${req.method}] ${req.originalUrl}`);
  next();
});

// API Routes
app.use('/api/rooms', roomRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/stats', statRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'Hotel Room Booking System API'
  });
});

// Fallback to index.html for SPA client navigation (Express 5 compatible)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error occurred',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start listening
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🏨 Hotel Room Booking System Server Running!`);
  console.log(`🌐 Local URL: http://localhost:${PORT}`);
  console.log(`📁 Database: SQLite (database/hotel.sqlite)`);
  console.log(`====================================================`);
});
