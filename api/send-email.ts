import type { VercelRequest, VercelResponse } from '@vercel/node';
import { clientIp } from './_lib/emailGuard';
import { processSendEmail } from './_lib/sendEmailCore';

// Sin cabeceras CORS: solo la propia app (mismo origen) puede llamar a esta función
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const result = await processSendEmail({
    method: req.method,
    origin: req.headers.origin,
    host: req.headers.host,
    ip: clientIp(req.headers),
    body: req.body,
    env: {
      user: process.env.GMAIL_USER,
      pass: (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, ''),
      allowedOrigins: process.env.ALLOWED_ORIGINS,
      production: process.env.VERCEL_ENV === 'production',
    },
  });
  for (const [name, value] of Object.entries(result.headers ?? {})) res.setHeader(name, value);
  return res.status(result.status).json(result.json);
}
