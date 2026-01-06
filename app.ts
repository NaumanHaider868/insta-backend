'use strict';
import express from 'express';
import bodyParser from 'body-parser';
import morgan from 'morgan';
import { config } from 'dotenv';
import appRouter from './routes';
import { formatError } from './utils';
import path from 'path';
import process from 'process';
import cors from 'cors'; // ✅ added

// ENV config
config();

const app = express();

// ✅ Allow requests from all origins
app.use(cors());

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use(morgan('dev'));

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));
app.get('/favicon.ico', (_, res) => {
  res.sendFile(path.join(__dirname, 'public', 'favicon.ico'));
});

// ✅ Mount routes after CORS setup
appRouter(app);

// Server init
const port = process.env.PORT ?? 8000;
const server = app.listen(port, () => {
  console.log('🚀 App running on port', port);
});

const shutdown = () => {
  console.log('🛑 Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed.');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

process.on('unhandledRejection', (err: Error) => {
  console.error('unhandledRejection', formatError(err));
  server.close(() => {
    process.exit(1);
  });
});

process.on('uncaughtException', (err: Error) => {
  console.error('uncaughtException', formatError(err));
  server.close(() => {
    process.exit(1);
  });
});

export default app;
