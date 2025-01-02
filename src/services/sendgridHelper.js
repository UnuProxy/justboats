// src/services/sendgridHelper.js
const SENDGRID_API_KEY = process.env.REACT_APP_SENDGRID_API_KEY;
const SENDGRID_API_URL = 'https://api.sendgrid.com/v3/mail/send';

export const sendEmail = async ({ to, subject, text, html }) => {
  try {
    const response = await fetch(SENDGRID_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: to }],
        }],
        from: {
          email: 'info@justenjoyibiza.com',
          name: 'Just Boats Ibiza'
        },
        subject: subject,
        content: [
          {
            type: 'text/plain',
            value: text
          },
          {
            type: 'text/html',
            value: html || text.replace(/\n/g, '<br>')
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`SendGrid API error: ${JSON.stringify(error)}`);
    }

    return true;
  } catch (error) {
    console.error('SendGrid sending error:', error);
    throw error;
  }
};