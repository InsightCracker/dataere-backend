require("dotenv").config();
const mongoose = require("mongoose");
const User     = require("../models/User");

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const result = await User.updateMany(
    { notificationPrefs: { $exists: false } },   // only users missing the field
    {
      $set: {
        notificationPrefs: {
          dailyReminders:     false,
          leaderboardUpdates: false,
        },
      },
    }
  );

  console.log(`✅ Updated ${result.modifiedCount} users`);
  await mongoose.disconnect();
}

migrate().catch(console.error);