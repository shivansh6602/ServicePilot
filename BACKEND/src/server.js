import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import prisma from './config/prisma.js';
import authRoutes from './routes/auth.routes.js';
import customerRoutes from './routes/customer.routes.js';

// Load environment variables from .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Standard middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);

// Health Check Endpoint (Verifies server and database connection)
app.get('/health', async (req, res) => {
  try {
    // Execute simple raw query to verify PostgreSQL database connection integrity
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      status: 'healthy',
      service: 'ServicePilot Backend API',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      service: 'ServicePilot Backend API',
      database: 'disconnected',
      error: error.message,
    });
  }
});

// Start Express HTTP Server on 127.0.0.1 (Localhost)
app.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 ServicePilot Backend API running on http://127.0.0.1:${PORT}`);
  console.log(`📡 Health check available at http://127.0.0.1:${PORT}/health`);
});
