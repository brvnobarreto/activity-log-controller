/**
 * ============================================
 * SERVIÇO DE EMAIL
 * ============================================
 *
 * Responsável por enviar emails usando SMTP ou, caso não esteja configurado,
 * apenas registrar o conteúdo no console (para ambientes de desenvolvimento).
 */

import nodemailer from 'nodemailer';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || SMTP_USER || 'no-reply@example.com';

const isEmailConfigured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

const transporter = isEmailConfigured
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    })
  : null;

export async function sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<void> {
  if (!isEmailConfigured || !transporter) {
    console.log('\n[EmailService] SMTP não configurado. Email não enviado.');
    console.log('Destinatário:', to);
    console.log('Assunto:', subject);
    console.log('Conteúdo HTML:', html);
    if (text) {
      console.log('Conteúdo Texto:', text);
    }
    console.log('Configure SMTP (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS) para enviar emails de verdade.\n');
    return;
  }

  await transporter.sendMail({
    from: EMAIL_FROM,
    to,
    subject,
    html,
    text,
  });
}
