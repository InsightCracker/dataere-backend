const crypto = require("crypto");
const User   = require("../models/User");
const Score  = require("../models/Score");
const { generateToken } = require("../utils/jwt");
const { sendPasswordResetEmail } = require("../emails/emailService");

// ─── Register 
const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ success: false, message: "Email already in use" });
    }
    const user = await User.create({ username, email, password });

    // Start streak on first login
    user.updateStreak();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id);
    res.status(201).json({
      success: true,
      message: "Account created successfully",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        streak: user.streak,
        longestStreak: user.longestStreak,
        joinDate: user.createdAt,
        isPublic: user.isPublic,
        notificationPrefs: user.notificationPrefs, 
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── Login 
const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: "Email/username and password are required" });
    }

    const isEmail = identifier.includes("@");
    const user = await User.findOne(
      isEmail ? { email: identifier.toLowerCase() } : { username: identifier }
    ).select("+password");

    if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password"
    });
}

    // Update streak on login
    user.updateStreak();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id);
    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        streak: user.streak,
        longestStreak: user.longestStreak,
        joinDate: user.createdAt,
        isPublic: user.isPublic,
        notificationPrefs: user.notificationPrefs, 
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── Get current user profile 
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        streak: user.streak,
        longestStreak: user.longestStreak,
        joinDate: user.createdAt,
        isPublic: user.isPublic,
        notificationPrefs: user.notificationPrefs, 
      },
    });
  } catch (err) {
    console.error("Get me error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── Update profile (name + email) 
const updateProfile = async (req, res) => {
  try {
    const { username, email } = req.body;

    if (!username && !email) {
      return res.status(400).json({ success: false, message: "Nothing to update" });
    }

    // Check if new email is already taken by someone else
    if (email && email !== req.user.email) {
      const exists = await User.findOne({ email: email.toLowerCase() });
      if (exists) {
        return res.status(409).json({ success: false, message: "Email already in use" });
      }
    }

    const updates = {};
    if (username) updates.username = username.trim();
    if (email)    updates.email    = email.toLowerCase().trim();

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        streak: user.streak,
        longestStreak: user.longestStreak,
        joinDate: user.createdAt,
        isPublic: user.isPublic,
        notificationPrefs: user.notificationPrefs, 
      },
    });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Update User's Privacy Mode
const updatePrivacy = async (req, res) => {
  try {
    const { isPublic } = req.body;

    if (typeof isPublic !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isPublic must be true or false",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { isPublic },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, user });
  } catch (err) {
    console.error("Update privacy error:", err);
    res.status(500).json({ success: false, message: "Failed to update privacy setting" });
  }
};

// ─── Delete account 
const deleteAccount = async (req, res) => {
  try {
    const userId = req.user._id;

    // Delete all scores belonging to this user
    await Score.deleteMany({ user: userId });

    // Delete the user
    await User.findByIdAndDelete(userId);

    res.status(200).json({
      success: true,
      message: "Account and all associated data deleted successfully",
    });
  } catch (err) {
    console.error("Delete account error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── Forgot password 
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(200).json({ success: true, message: "If that email exists, a reset link has been sent" });
    }
    const resetToken  = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");
    user.resetPasswordToken   = hashedToken;
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    const resetURL = `${process.env.CLIENT_URL}/users/reset-password/${resetToken}`;
    await sendPasswordResetEmail(user.email, resetURL, user.username);

    res.status(200).json({ success: true, message: "If that email exists, a reset link has been sent" });
  } catch (err) {
    console.error("Forgot password error:", err);
    if (err.message === "Failed to send reset email") {
      await User.findOneAndUpdate(
        { email: req.body.email },
        { resetPasswordToken: null, resetPasswordExpires: null }
      );
    }
    res.status(500).json({ success: false, message: "Server error. Please try again." });
  }
};

// ─── Reset password 
const resetPassword = async (req, res) => {
  try {
    const { token }    = req.params;
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      resetPasswordToken:   hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });
    if (!user) {
      return res.status(400).json({ success: false, message: "Reset link is invalid or has expired" });
    }
    user.password             = password;
    user.resetPasswordToken   = null;
    user.resetPasswordExpires = null;
    await user.save();
    res.status(200).json({ success: true, message: "Password reset successful. You can now log in." });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { 
  register, 
  login, 
  getMe, 
  updateProfile, 
  updatePrivacy, 
  deleteAccount, 
  forgotPassword, 
  resetPassword 
};