const { Resend } = require("resend");

const sendPasswordResetEmail = async (toEmail, resetURL, username) => {
  const resend = new Resend(process.env.RESEND_API_KEY);

  const { data, error } = await resend.emails.send({
    from: "DataEre <onboarding@resend.dev>",
    to: toEmail,
    subject: "Reset your DataEre password",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Reset your password</title>
        </head>
        <body style="margin:0;padding:0;background:#f0f4ff;font-family:'Segoe UI',Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
            <tr>
              <td align="center">
                <table width="480" cellpadding="0" cellspacing="0"
                  style="background:#ffffff;border-radius:20px;overflow:hidden;
                  box-shadow:0 8px 40px rgba(59,110,240,0.10);">
                  <tr>
                    <td style="height:4px;background:linear-gradient(90deg,#2251cc,#3b6ef0,#6b96f5);"></td>
                  </tr>
                  <tr>
                    <td style="padding:40px 40px 32px;">
                      <p style="margin:0 0 28px;font-size:24px;font-weight:900;letter-spacing:-1px;color:#111827;">
                        Data<span style="color:#3b6ef0;">Ere</span>
                      </p>
                      <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">
                        Reset your password
                      </p>
                      <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.6;">
                        Hi ${username}, we received a request to reset your DataEre password.
                        Click the button below - this link is valid for <strong>1 hour</strong>.
                      </p>
                      <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                        <tr>
                          <td style="border-radius:12px;background:linear-gradient(135deg,#2251cc,#3b6ef0);">
                            <a href="${resetURL}"
                              style="display:inline-block;padding:14px 32px;color:#ffffff;
                              font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;">
                              Reset Password
                            </a>
                          </td>
                        </tr>
                      </table>
                      <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;">
                        Or copy this link into your browser:
                      </p>
                      <p style="margin:0 0 28px;font-size:13px;color:#3b6ef0;word-break:break-all;">
                        ${resetURL}
                      </p>
                      <hr style="border:none;border-top:1px solid rgba(59,110,240,0.12);margin:0 0 24px;" />
                      <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
                        If you didn't request this, you can safely ignore this email.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:20px 40px;background:#f8faff;border-top:1px solid rgba(59,110,240,0.08);">
                      <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
                        © ${new Date().getFullYear()} DataEre. All rights reserved.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  });

  if (error) {
    console.error("❌ Email send error:", error);
    throw new Error("Failed to send reset email");
  }

  return data;
};

const sendDailyReminderEmail = async (toEmail, username, currentStreak) => {
  const { data, error } = await resend.emails.send({
    from: "DataEre <onboarding@resend.dev>",
    to: toEmail,
    subject: `Your ${currentStreak}-day streak is waiting 🔥`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Keep your streak alive</title>
        </head>
        <body style="margin:0;padding:0;background:#f0f4ff;font-family:'Segoe UI',Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
            <tr>
              <td align="center">
                <table width="480" cellpadding="0" cellspacing="0"
                  style="background:#ffffff;border-radius:20px;overflow:hidden;
                  box-shadow:0 8px 40px rgba(59,110,240,0.10);">
                  
                  <!-- Top accent bar -->
                  <tr>
                    <td style="height:4px;background:linear-gradient(90deg,#2251cc,#3b6ef0,#6b96f5);"></td>
                  </tr>

                  <!-- Main content -->
                  <tr>
                    <td style="padding:40px 40px 32px;">

                      <!-- Logo -->
                      <p style="margin:0 0 28px;font-size:24px;font-weight:900;letter-spacing:-1px;color:#111827;">
                        Data<span style="color:#3b6ef0;">Ere</span>
                      </p>

                      <!-- Streak badge -->
                      <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                        <tr>
                          <td style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:16px 24px;text-align:center;">
                            <p style="margin:0;font-size:36px;">🔥</p>
                            <p style="margin:4px 0 0;font-size:22px;font-weight:800;color:#ea580c;">
                              ${currentStreak} day streak
                            </p>
                            <p style="margin:4px 0 0;font-size:13px;color:#9a3412;">
                              Don't let it reset to zero
                            </p>
                          </td>
                        </tr>
                      </table>

                      <!-- Heading + body -->
                      <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">
                        Hey ${username}, practice today!
                      </p>
                      <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.6;">
                        You haven't practised on DataEre today. It only takes a few minutes to
                        keep your streak alive and climb the leaderboard.
                      </p>

                      <!-- CTA button -->
                      <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                        <tr>
                          <td style="border-radius:12px;background:linear-gradient(135deg,#2251cc,#3b6ef0);">
                            <a href="https://dataxo.cfd"
                              style="display:inline-block;padding:14px 32px;color:#ffffff;
                              font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;">
                              Get In Today →
                            </a>
                          </td>
                        </tr>
                      </table>

                      <hr style="border:none;border-top:1px solid rgba(59,110,240,0.12);margin:0 0 24px;" />

                      <!-- Unsubscribe hint -->
                      <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
                        You're receiving this because you enabled daily reminders in your
                        DataEre settings. You can turn them off anytime under
                        <a href="https://dataxo.cfd/settings?tab=notif"
                          style="color:#3b6ef0;text-decoration:none;">Notification Settings</a>.
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding:20px 40px;background:#f8faff;border-top:1px solid rgba(59,110,240,0.08);">
                      <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
                        © ${new Date().getFullYear()} DataEre. All rights reserved.
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  });

  if (error) {
    console.error("❌ Reminder email error:", error);
    throw new Error("Failed to send reminder email");
  }

  return data;
};

module.exports = { sendPasswordResetEmail, sendDailyReminderEmail };