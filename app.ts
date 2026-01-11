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

config();

const app = express();

app.use(cors());

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use(morgan('dev'));

app.get('/favicon.ico', (_, res) => {
  res.sendFile(path.join(__dirname, 'public', 'favicon.ico'));
});

appRouter(app);

const port = process.env.PORT;
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
