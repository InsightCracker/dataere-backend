require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const scoreRoutes = require("./routes/scoreRoutes");
const passport = require("./config/passport");
const dailyChallengeRoutes = require("./routes/dailyChallengeRoutes")
const notifPrefRoutes = require("./routes/notificationPrefs");

require("./jobs/dailyReminders");

const app = express();

connectDB();

app.use(cors({
  origin: [
    "https://www.dataxo.cfd",
    "https://dataxo.cfd",
    "https://dataere.vercel.app",
    "http://localhost:5173",
  ],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(passport.initialize()); 

app.use("/api/auth",   authRoutes);
app.use("/api/scores", scoreRoutes);
app.use("/api/dailyChallenge", dailyChallengeRoutes);
app.use("/api/user/notification-prefs", notifPrefRoutes);

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "DataEre API is running 🚀" });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, message: "Internal server error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});