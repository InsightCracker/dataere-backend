const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      trim: true,
      minlength: [2, "Username must be at least 2 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    password: {
      type: String,
      required: function () {
        return this.provider === "local";
      },
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },

    // ── OAuth identity 
    provider: {
      type: String,
      enum: ["local", "google", "github"],
      default: "local",
    },
    googleId: { type: String, default: null, index: true, sparse: true },
    githubId: { type: String, default: null, index: true, sparse: true },
    avatar:   { type: String, default: null },

    resetPasswordToken:   { type: String, default: null },
    resetPasswordExpires: { type: Date,   default: null },

    // ── Streak tracking 
    streak:        { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    lastLoginDate: { type: Date,   default: null },

    // ── Privacy 
    // Whether this user's username/scores appear on the public leaderboard.
    isPublic: { type: Boolean, default: true },

    // ── Notification preferences 
    notificationPrefs: {
      dailyReminders:     { type: Boolean, default: false },
      leaderboardUpdates: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

// Hash password before saving (skip if no password, e.g. OAuth users)
userSchema.pre("save", async function () {
  if (!this.isModified("password") || !this.password) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = async function (enteredPassword) {
  if (!this.password) return false; // OAuth-only accounts can't password-login
  return await bcrypt.compare(enteredPassword, this.password);
};

// ── Streak logic (unchanged) 
userSchema.methods.updateStreak = function () {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const last  = this.lastLoginDate
    ? new Date(
        this.lastLoginDate.getFullYear(),
        this.lastLoginDate.getMonth(),
        this.lastLoginDate.getDate()
      )
    : null;

  if (!last) {
    this.streak = 1;
    this.lastLoginDate = now;
  } else {
    const diffDays = Math.round((today - last) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return;
    else if (diffDays === 1) this.streak += 1;
    else this.streak = 1;
    this.lastLoginDate = now;
  }

  if (this.streak > this.longestStreak) {
    this.longestStreak = this.streak;
  }
};

module.exports = mongoose.model("User", userSchema);