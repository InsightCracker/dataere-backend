const cron = require("node-cron");
const User = require("../models/User");
const { sendDailyReminderEmail } = require("../emails/emailService.js");

cron.schedule("0 12 * * *", async () => {
  console.log("⏰ Running daily reminder cron...");

  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const users = await User.find({
      "notificationPrefs.dailyReminders": true,
      $or: [
        { lastActiveAt: { $lt: cutoff } },
        { lastActiveAt: null },
      ],
    }).select("email username streak");

    console.log(`📧 Sending reminders to ${users.length} user(s)`);

    for (const user of users) {
      try {
        await sendDailyReminderEmail(user.email, user.username, user.streak);
        console.log(`✅ Reminder sent to ${user.email}`);
      } catch (err) {
        console.error(`❌ Failed to remind ${user.email}:`, err.message);
      }
    }

    console.log("✅ Daily reminder cron complete");
  } catch (err) {
    console.error("❌ Daily reminder cron error:", err.message);
  }
});