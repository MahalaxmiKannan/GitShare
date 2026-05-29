import express from 'express';
import passport from 'passport';

const router = express.Router();

// @desc    Auth with GitHub
// @route   GET /auth/github
router.get('/github', passport.authenticate('github', { scope: ['user:email', 'repo'] }));

// @desc    GitHub auth callback
// @route   GET /auth/github/callback
router.get('/github/callback', 
  passport.authenticate('github', { failureRedirect: `${process.env.CLIENT_URL}/?auth_error=true` }),
  (req, res) => {
    // Successful authentication, redirect to frontend.
    res.redirect(process.env.CLIENT_URL);
  }
);

// @desc    Get current user profile
// @route   GET /auth/user
router.get('/user', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ user: req.user });
  } else {
    res.json({ user: null });
  }
});

// @desc    Logout user
// @route   GET /auth/logout
router.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    // Clean up session
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error('Error destroying session during logout:', err);
        }
        res.clearCookie('connect.sid');
        res.redirect(process.env.CLIENT_URL);
      });
    } else {
      res.redirect(process.env.CLIENT_URL);
    }
  });
});

export default router;
