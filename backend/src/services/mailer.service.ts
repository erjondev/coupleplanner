import nodemailer, { Transporter } from 'nodemailer';

/**
 * Envoi d'emails transactionnels (réinitialisation de mot de passe).
 *
 * Configuration via variables d'environnement SMTP_* (voir .env.example).
 * Comme pour la clé Gemini, la fonctionnalité se dégrade proprement : si le
 * SMTP n'est pas configuré, on NE bloque pas — on log le contenu côté serveur
 * (utile en dev, ou en dépannage à partir des logs). Ne jamais renvoyer le
 * code dans la réponse HTTP.
 */
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

const isConfigured = Boolean(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS);

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!isConfigured) return null;
  if (!transporter) {
    const port = Number(SMTP_PORT);
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: port === 465, // 465 = TLS implicite ; 587/25 = STARTTLS
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
}

/** Envoie le code de réinitialisation (ou le log si SMTP non configuré). */
export async function sendPasswordResetCode(to: string, code: string, name: string): Promise<void> {
  const subject = 'CouplePlanner — code de réinitialisation';
  const text =
    `Bonjour ${name},\n\n` +
    `Votre code de réinitialisation de mot de passe est : ${code}\n` +
    `Il expire dans 30 minutes.\n\n` +
    `Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email.`;

  const t = getTransporter();
  if (!t) {
    console.warn(
      `[mailer] SMTP non configuré — code de réinitialisation pour ${to} : ${code}`
    );
    return;
  }

  await t.sendMail({ from: SMTP_FROM ?? SMTP_USER, to, subject, text });
}
