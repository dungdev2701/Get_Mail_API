import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { emailRoutes } from './routes/emails';

dotenv.config();

const fastify = Fastify({
  logger: true,
});

// Register CORS
fastify.register(cors, {
  origin: process.env.FRONTEND_URL || '*',
});

// API Key authentication middleware
fastify.addHook('onRequest', async (request, reply) => {
  // Skip authentication for health check
  if (request.url === '/health') {
    return;
  }

  const apiKey = request.headers['x-api-key'];
  const validApiKey = process.env.API_KEY;

  if (!validApiKey) {
    fastify.log.warn('API_KEY not configured in environment');
    return reply.status(500).send({ error: 'Server configuration error' });
  }

  if (!apiKey || apiKey !== validApiKey) {
    return reply.status(401).send({ error: 'Unauthorized - Invalid or missing API key' });
  }
});

// Register routes
fastify.register(emailRoutes, { prefix: '/api/emails' });

// Health check
fastify.get('/health', async () => {
  return { status: 'ok' };
});

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '4000');
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Server running on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
