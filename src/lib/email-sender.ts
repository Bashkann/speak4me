export interface EmailSender {
  send(to: string, subject: string, html: string): Promise<void>;
}

interface ResendConfig {
  apiKey: string;
  fromEmail: string;
}

export class ResendEmailSender implements EmailSender {
  constructor(private readonly config: ResendConfig) {}

  async send(to: string, subject: string, html: string): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: this.config.fromEmail, to, subject, html }),
    });
    if (!response.ok) {
      throw new Error(`Resend email delivery failed with status ${response.status}`);
    }
  }
}
