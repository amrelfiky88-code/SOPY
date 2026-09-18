import 'dotenv/config';
import { createApp } from './app.js';

const app = createApp();
const port = process.env.PORT || 4000;
const server = app.listen(port, () => console.log(`SOPY API listening on :${port}`));

// Node closes idle keep-alive sockets after 5s. A proxy in front (Vite in
// dev, the host's load balancer in production) can reuse a socket at the
// moment Node closes it, and the request dies with ECONNRESET — that is
// what left the checklist library empty on phones. Outlive the proxy's
// own idle timeout instead (headersTimeout must exceed keepAliveTimeout).
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
