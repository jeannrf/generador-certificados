import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { processSendEmail } from './api/_lib/sendEmailCore';

// En desarrollo, /api/send-email usa la misma lógica (y las mismas reglas de seguridad) que la función de Vercel
function apiDevServerPlugin() {
  return {
    name: 'api-dev-server',
    configureServer(server: any) {
      server.middlewares.use('/api/send-email', (req: any, res: any) => {
        let body = '';
        req.on('data', (chunk: any) => {
          body += chunk;
        });
        req.on('end', async () => {
          const env = loadEnv('development', process.cwd(), '');
          let payload: unknown = {};
          try {
            payload = body ? JSON.parse(body) : {};
          } catch {
            payload = {};
          }
          const result = await processSendEmail({
            method: req.method,
            origin: req.headers.origin,
            host: req.headers.host,
            ip: req.socket?.remoteAddress || 'local',
            body: payload,
            env: {
              user: env.GMAIL_USER || process.env.GMAIL_USER,
              pass: (env.GMAIL_APP_PASSWORD || process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, ''),
              allowedOrigins: env.ALLOWED_ORIGINS,
              production: false,
            },
          });
          res.statusCode = result.status;
          res.setHeader('Content-Type', 'application/json');
          for (const [name, value] of Object.entries(result.headers ?? {})) res.setHeader(name, value);
          res.end(JSON.stringify(result.json));
        });
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
            // fontkit solo se usa al incrustar fuentes en el PDF: va aparte y se carga a demanda
            if (id.includes('@pdf-lib/fontkit')) {
              return 'vendor-fontkit';
            }
            if (id.includes('pdf-lib') || id.includes('pdfjs-dist') || id.includes('@pdf-lib')) {
              return 'vendor-pdf';
            }
            if (id.includes('xlsx')) {
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
