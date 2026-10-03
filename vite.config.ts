import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import nodemailer from 'nodemailer';

function apiDevServerPlugin() {
  return {
    name: 'api-dev-server',
    configureServer(server: any) {
      server.middlewares.use('/api/send-email', (req: any, res: any) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => {
            body += chunk;
          });
          req.on('end', async () => {
            res.setHeader('Content-Type', 'application/json');
            try {
              const env = loadEnv('development', process.cwd(), '');
              const user = env.GMAIL_USER || env.GEMAIL_USER || process.env.GMAIL_USER || process.env.GEMAIL_USER;
              const pass = (env.GMAIL_APP_PASSWORD || process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

              const payload = body ? JSON.parse(body) : {};
              if (payload.action === 'ping') {
                if (!user || !pass) {
                  res.statusCode = 200;
                  res.end(JSON.stringify({ ok: false, error: 'Credenciales GMAIL no configuradas en .env.local.' }));
                  return;
                }
                res.statusCode = 200;
                res.end(JSON.stringify({ ok: true, message: `Conectado localmente a ${user}` }));
                return;
              }

              if (!user || !pass) {
                res.statusCode = 500;
                res.end(JSON.stringify({ ok: false, error: 'Credenciales GMAIL no configuradas en .env.local.' }));
                return;
              }

              const { to, subject, html, htmlBody, senderName, attachment } = payload;
              const contentHtml = html || htmlBody;

              const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: { user, pass },
              });

              const mailOptions: any = {
                from: `"${senderName || 'Emisión de Certificados'}" <${user}>`,
                to: (to || '').trim(),
                subject,
                html: contentHtml,
              };

              if (attachment && attachment.base64 && attachment.filename) {
                mailOptions.attachments = [
                  {
                    filename: attachment.filename,
                    content: Buffer.from(attachment.base64, 'base64'),
                    contentType: 'application/pdf',
                  },
                ];
              }

              const info = await transporter.sendMail(mailOptions);
              res.statusCode = 200;
              res.end(JSON.stringify({ ok: true, messageId: info.messageId }));
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ ok: false, error: err?.message || 'Error enviando correo localmente' }));
            }
          });
        } else {
          res.statusCode = 405;
          res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), apiDevServerPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('pdf-lib') || id.includes('pdfjs-dist') || id.includes('@pdf-lib')) {
              return 'vendor-pdf';
            }
            if (id.includes('xlsx') || id.includes('read-excel-file')) {
              return 'vendor-excel';
            }
            if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            if (id.includes('lucide-react') || id.includes('canvas-confetti') || id.includes('fflate') || id.includes('papaparse')) {
              return 'vendor-utils';
            }
          }
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
  },
});
