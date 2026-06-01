const express = require("express");
const router  = express.Router();
const {
  register,
  login,
  getMe,
  updateProfile,
  deleteAccount,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

// Public
router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

// Protected
router.get("/me", protect, getMe);
router.put("/profile", protect, updateProfile);
router.delete("/account", protect, deleteAccount);

module.exports = router;