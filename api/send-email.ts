import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Configuración de CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Método no permitido. Use POST.' });
  }

  const user = process.env.GMAIL_USER || process.env.EMAIL_USER;
  const pass = (process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS || '').replace(/\s+/g, '');

  const body = req.body || {};
  const { to, subject, html, htmlBody, senderName, attachment, action } = body;
  const contentHtml = html || htmlBody;

  // Verificación de estado del servicio (Health Check / Ping)
  if (action === 'ping') {
    if (!user || !pass) {
      return res.status(200).json({
        ok: false,
        configured: false,
        error: 'GMAIL_USER o GMAIL_APP_PASSWORD no configurados en Vercel.',
      });
    }

    return res.status(200).json({
      ok: true,
      configured: true,
      message: `Servicio de correo activo conectado a ${user}.`,
    });
  }

  if (!user || !pass) {
    return res.status(500).json({
      ok: false,
      error: 'Las variables GMAIL_USER o GMAIL_APP_PASSWORD no están configuradas en Vercel.',
    });
  }

  if (!to || !subject || !contentHtml) {
    return res.status(400).json({
      ok: false,
      error: 'Faltan campos obligatorios: destinatario (to), asunto (subject) o cuerpo del correo.',
    });
  }

  try {
    const cleanSenderName = senderName ? senderName.trim().replace(/[<>"']/g, '') : 'Emisión de Certificados';
    const from = `"${cleanSenderName}" <${user}>`;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass,
      },
    });

    const mailOptions: nodemailer.SendMailOptions = {
      from,
      to: to.trim(),
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

    return res.status(200).json({
      ok: true,
      messageId: info.messageId,
      message: 'Correo enviado con éxito.',
    });
  } catch (error: any) {
    console.error('Error al enviar correo vía Nodemailer:', error);
    return res.status(500).json({
      ok: false,
      error: error?.message || 'Error del servidor al enviar el correo.',
    });
  }
}
