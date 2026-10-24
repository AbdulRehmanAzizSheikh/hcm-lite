import { connectDB } from '@/lib/backend';
import app from '@/lib/backend';

let connected = false;

export default async function handler(req, res) {
  if (!connected) {
    await connectDB();
    connected = true;
  }
  // rewrite path: /api/auth/login -> /auth/login
  req.url = req.url.replace(/^\/api/, '') || '/';
  // delegate to express app
  app(req, res);
}
