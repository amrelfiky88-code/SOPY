// Entry point for hosts that start the app from the repository root
// (Hostinger's Node.js Web App runs this file). The server resolves its
// uploads, shares and web/dist folders relative to the server/ directory,
// so switch into it before loading the server.
import { fileURLToPath } from 'node:url';
import path from 'node:path';

process.chdir(path.join(path.dirname(fileURLToPath(import.meta.url)), 'server'));
await import('./server/src/index.js');
