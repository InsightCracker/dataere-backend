const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const GitHubStrategy = require("passport-github2").Strategy;
const User = require("../models/User");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL, 
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;

        let user = await User.findOne({ googleId: profile.id });

        if (!user && email) {
          user = await User.findOne({ email });
          if (user) {
            user.googleId = profile.id;
            if (!user.avatar) user.avatar = profile.photos?.[0]?.value || null;
            await user.save({ validateBeforeSave: false });
          }
        }

        if (!user) {
          user = await User.create({
            username: profile.displayName || email?.split("@")[0] || `user_${profile.id}`,
            email: email || `${profile.id}@google.placeholder`,
            provider: "google",
            googleId: profile.id,
            avatar: profile.photos?.[0]?.value || null,
          });
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: process.env.GITHUB_CALLBACK_URL, 
      scope: ["user:email"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email =
          profile.emails?.[0]?.value ||
          `${profile.username}@users.noreply.github.com`;

        let user = await User.findOne({ githubId: profile.id });

        if (!user) {
          user = await User.findOne({ email });
          if (user) {
            user.githubId = profile.id;
            if (!user.avatar) user.avatar = profile.photos?.[0]?.value || null;
            await user.save({ validateBeforeSave: false });
          }
        }

        if (!user) {
          user = await User.create({
            username: profile.username || profile.displayName || `user_${profile.id}`,
            email,
            provider: "github",
            githubId: profile.id,
            avatar: profile.photos?.[0]?.value || null,
          });
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

module.exports = passport;