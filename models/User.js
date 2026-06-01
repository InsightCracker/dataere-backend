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
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    resetPasswordToken:   { type: String, default: null },
    resetPasswordExpires: { type: Date,   default: null },

    // ── Streak tracking 
    streak:        { type: Number, default: 0 },   // current streak in days
    longestStreak: { type: Number, default: 0 },   // all-time best streak
    lastLoginDate: { type: Date,   default: null }, // last day a login was recorded
  },
  { timestamps: true } // createdAt = join date
);

// Hash password before saving
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// ── Streak logic — call this on every login 
userSchema.methods.updateStreak = function () {
  const now       = new Date();
  const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // midnight today
  const last      = this.lastLoginDate
    ? new Date(
        this.lastLoginDate.getFullYear(),
        this.lastLoginDate.getMonth(),
        this.lastLoginDate.getDate()
      )
    : null;

  if (!last) {
    // First ever login
    this.streak = 1;
    this.lastLoginDate = now;
  } else {
    const diffDays = Math.round((today - last) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // Already logged in today — do nothing
      return;
    } else if (diffDays === 1) {
      // Consecutive day — increment streak
      this.streak += 1;
    } else {
      // Missed at least one day — reset streak
      this.streak = 1;
    }
    this.lastLoginDate = now;
  }

  // Update longest streak record
  if (this.streak > this.longestStreak) {
    this.longestStreak = this.streak;
  }
};

module.exports = mongoose.model("User", userSchema);