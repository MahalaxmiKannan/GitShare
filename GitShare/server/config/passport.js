import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import User from '../models/User.js';
import {
  GITHUB_CALLBACK_URL,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET
} from '../config.js';

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

const clientID = GITHUB_CLIENT_ID;
const clientSecret = GITHUB_CLIENT_SECRET;
const callbackURL = GITHUB_CALLBACK_URL;

if (!clientID || !clientSecret) {
  console.warn('⚠️ Warning: GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET is missing in environment variables. GitHub OAuth will not function correctly.');
}

passport.use(
  new GitHubStrategy(
    {
      clientID: clientID || '',
      clientSecret: clientSecret || '',
      callbackURL: callbackURL
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ githubId: profile.id });
        
        const avatarUrl = profile.photos && profile.photos.length > 0 
          ? profile.photos[0].value 
          : (profile._json && profile._json.avatar_url ? profile._json.avatar_url : '');
        
        const username = profile.username || profile.displayName || `github_${profile.id}`;

        if (!user) {
          user = new User({
            githubId: profile.id,
            username: username,
            avatarUrl: avatarUrl,
            accessToken: accessToken
          });
          await user.save();
        } else {
          // Update username, avatar or accessToken if changed
          let isModified = false;
          if (user.username !== username) {
            user.username = username;
            isModified = true;
          }
          if (avatarUrl && user.avatarUrl !== avatarUrl) {
            user.avatarUrl = avatarUrl;
            isModified = true;
          }
          if (user.accessToken !== accessToken) {
            user.accessToken = accessToken;
            isModified = true;
          }
          if (isModified) {
            await user.save();
          }
        }
        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

export default passport;
