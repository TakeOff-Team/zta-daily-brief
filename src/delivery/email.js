import { Resend } from 'resend';

export async function sendEmail(brief, config, date) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const to = config.delivery?.email;
  if (!to) {
    console.log('No email configured — skipping email delivery.');
    return;
  }

  const briefName = config.briefName || 'Daily Brief';
  const subject = `${briefName} — ${date}`;

  // Convert markdown to basic HTML for email
  const htmlBody = markdownToHtml(brief);

  const { data, error } = await resend.emails.send({
    from: `${briefName} <briefs@resend.dev>`,
    to,
    subject,
    html: htmlBody,
    text: brief,
  });

  if (error) {
    console.error('Email delivery failed:', error);
    throw new Error(`Email failed: ${error.message}`);
  }

  console.log(`Email sent to ${to} (ID: ${data.id})`);
}

function markdownToHtml(md) {
  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 700px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; line-height: 1.6; }
    h1 { font-size: 24px; border-bottom: 2px solid #000; padding-bottom: 8px; }
    h2 { font-size: 18px; margin-top: 32px; color: #111; }
    ul { padding-left: 20px; }
    li { margin-bottom: 6px; }
    hr { border: none; border-top: 1px solid #ddd; margin: 32px 0; }
    small { color: #666; font-size: 12px; }
  </style>
</head>
<body>
${md
  .replace(/^# (.+)$/gm, '<h1>$1</h1>')
  .replace(/^## (.+)$/gm, '<h2>$1</h2>')
  .replace(/^- (.+)$/gm, '<li>$1</li>')
  .replace(/(<li>.*<\/li>\n?)+/gs, match => `<ul>${match}</ul>`)
  .replace(/^---$/gm, '<hr>')
  .replace(/\*(.+?)\*/g, '<em>$1</em>')
  .replace(/\n\n/g, '</p><p>')
}
</body>
</html>`;
}
