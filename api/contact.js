const SUPABASE_CONTACT_URL =
  'https://ifvdoqjmveakhgpojufu.functions.supabase.co/contactForm';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({ success: false, error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    const {
      firstName,
      lastName,
      email,
      message,
      subscribe,
      token, // reCAPTCHA token
    } = body || {};

    if (!firstName || !lastName || !email || !message) {
      return res
        .status(400)
        .json({ success: false, error: 'Missing required fields' });
    }

    // Payload for Make (Neon + Slack)
    const makePayload = {
      first_name: firstName,
      last_name: lastName,
      email,
      message,
      subscribe: !!subscribe,
      recaptcha_token: token,
      submitted_at: new Date().toISOString(),
    };

    // 1) PRIMARY: send to Make (this will write to Neon + send Slack)
    const makeResp = await fetch(process.env.MAKE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makePayload),
    });

    if (!makeResp.ok) {
      console.error('Make webhook failed', await makeResp.text());
      return res
        .status(502)
        .json({ success: false, error: 'Upstream Make error' });
    }

    // Supabase payload (exactly what your current front-end sends today)
    const supabasePayload = {
      firstName,
      lastName,
      email,
      message,
      subscribe,
      token,
    };

    // 2) SECONDARY: forward to Supabase (fire-and-forget)
    fetch(SUPABASE_CONTACT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(supabasePayload),
    }).catch((err) => {
      console.error('Supabase contactForm failed', err);
    });

    // Match the existing front-end expectation: { success: true }
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Contact handler error', err);
    return res
      .status(500)
      .json({ success: false, error: 'Internal server error' });
  }
}
