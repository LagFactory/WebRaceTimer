import Fastify from 'fastify';
import path from 'path';
import { fileURLToPath } from 'url';
import fastifyStatic from '@fastify/static';
import dbConnector from './db.mjs';
import apis from './apis.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({ logger: true });

// 1) SQLite plugin: creates database.sqlite and ensures `store` table exists
fastify.register(dbConnector, {
  filename: path.join(__dirname, 'database.sqlite'),
});

// 2) Serve client/index.html at /
fastify.register(fastifyStatic, {
  root: path.join(__dirname, '../client'),
  index: ['index.html'],
  setHeaders(res, pathName) {
    if (pathName.endsWith('.mjs')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  },
});

// 3) Register your JSON-API routes (uses fastify.db)
fastify.register(apis);

async function startServer() {
  try {
    await fastify.listen({ port: 8080, host: '0.0.0.0' });
    console.log('Server running at http://0.0.0.0:8080');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

startServer();
