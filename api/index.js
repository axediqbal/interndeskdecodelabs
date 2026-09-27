// Vercel serverless entry — mounts the Express app so every /api/* route
// runs as a function. vercel.json rewrites /api/:path* here; the original
// request path is preserved, so Express routing works unchanged.
import app from '../backend/src/app.js';

export default function handler(req, res) {
  return app(req, res);
}
