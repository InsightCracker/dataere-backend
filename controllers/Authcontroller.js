const crypto = require("crypto");
const User = require("../models/User");
const { generateToken } = require("../utils/jwt");
const { sendPasswordResetEmail } = require("../emails/emailService");

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
    const token = generateToken(user._id);
    res.status(201).json({
      success: true,
      message: "Account created successfully",
      token,
      user: { id: user._id, username: user.username, email: user.email },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: "Email/username and password are required",
      });
    }

    // Check if identifier looks like an email or a username
    const isEmail = identifier.includes("@");

    const user = await User.findOne(
      isEmail ? { email: identifier.toLowerCase() } : { username: identifier }
    ).select("+password");

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const token = generateToken(user._id);
    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: { id: user._id, username: user.username, email: user.email },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

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
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");
    user.resetPasswordToken = hashedToken;
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

const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });
    if (!user) {
      return res.status(400).json({ success: false, message: "Reset link is invalid or has expired" });
    }
    user.password = password;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();
    res.status(200).json({ success: true, message: "Password reset successful. You can now log in." });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { register, login, forgotPassword, resetPassword };