import { createServer } from 'node:http';
import { initSocketIO } from '../sockets';

const server = createServer();
initSocketIO(server);

export default server;