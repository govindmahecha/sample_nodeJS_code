const passport = require('passport');
const querystring = require('querystring');

const { auth: AuthEndpoint } = require('./../../common/endpoints');
const User = require('./../models/User');
const Community = require('./../models/Community');

function setReturnTo(req, res, next) {
  console.log('setReturnTo', req.query['returnTo'])
  const returnTo = req.query['returnTo'];
  if (returnTo) {
    req.session = req.session || {};
    req.session.returnTo = querystring.unescape(returnTo);
  }
  next();
}



module.exports = function(app) {
  function logout(req, res, next){
    req.logout();
    res.clearCookie('isAuthenticated');
    req.session.destroy(err => {
      if (err) {
        return next(err);
      }
      req.user = null;
      res.redirect('/');
    });
  }

  async function onLoginSuccess(req, res, next){
    const userJson = await req.user.toCookieJson();
    const defaultCommunity = userJson.defaultCommunity;

    let stringifiedUser = JSON.stringify(userJson);

    let returnTo = '';

    const hasReturnTo = req.session.returnTo && req.session.returnTo.length && req.session.returnTo !== '/';

    if (req.cookies.joiningCommunity){
      const { slug, token } = JSON.parse(req.cookies.joiningCommunity);
      const community = await Community.findOne( { slug : slug });
      await community.addMember(req.user, token, req.originalUrl, req, res);
      console.log('added user to community', community.slug, req.user._id);
      // return res.redirect(`/${community.slug}`);
      stringifiedUser = JSON.stringify(await req.user.toCookieJson());
      returnTo = `/${community.slug}`;
    } else if (hasReturnTo){
      returnTo = req.session.returnTo;
    } else if (defaultCommunity && defaultCommunity.slug){
      returnTo = '/' + defaultCommunity.slug;
    }

    res.redirect(302,
      `/login?status=success&returnTo=${encodeURIComponent(returnTo)}&user=${encodeURIComponent(stringifiedUser)}`,
    );
  }

  async function onOAuthLoginSuccess(req, res, next) {
    onLoginSuccess(req, res, next);
  }

  // Linked in login
  app.get(AuthEndpoint.loginLinkedIn, setReturnTo, passport.authenticate('linkedin'));
  app.get(
    AuthEndpoint.loginLinkedInCallback,
    passport.authenticate('linkedin', {
      failureRedirect: '/login?status=error',
    }),
    onOAuthLoginSuccess,
  );

  // Google login
  app.get(AuthEndpoint.loginGoogle, setReturnTo, passport.authenticate('google', { scope: 'profile email' }));
  app.get(
    AuthEndpoint.loginGoogleCallback,
    passport.authenticate('google', {
      failureRedirect: '/login?status=error',
    }),
    onOAuthLoginSuccess,
  );

  // Email Login
  app.post(AuthEndpoint.loginEmail, setReturnTo, (req, res, next) => {
    req.assert('email', 'Email is not valid.').isEmail();
    req.assert('password', 'Password cannot be blank.').notEmpty();
    req.sanitize('email').normalizeEmail({ 
      gmail_remove_dots: false,
      gmail_remove_subaddress : false 
    });

    const errors = req.validationErrors();

    if (errors) {
      return res.status(401).json({
        status: 'error',
        message: errors.map(e => e.msg).join(' ')
      });
    }

    passport.authenticate('local', (err, user, info) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid email or password'
        });
      }
      req.logIn(user, err => {
        if (err) {
          return next(err);
        }
        onLoginSuccess(req, res, next);
      });
    })(req, res, next);
  });

  // Email Create Account
  app.post(AuthEndpoint.signupEmail, setReturnTo, async (req, res, next) => {
    req.assert('email', 'Email is not valid.').isEmail();
    req.assert('password', 'Password must be at least 4 characters long.').len(4);
    req.sanitize('email').normalizeEmail({ 
      gmail_remove_dots: false,
      gmail_remove_subaddress : false 
    });

    const errors = req.validationErrors();

    if (errors) {
      return res.status(400).json({
        status: 'error',
        message: `Could not create an account. ${errors.map(e => e.msg).join(' ')}`
      });
    }

    let existingUser = await User.findOne({ email: req.body.email });

    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'Account with that email address already exists.'
      });
    }

    let name = req.body.firstName ? req.body.firstName : '';
    if (req.body.lastName){
      name += ' ' + req.body.lastName;
    }
    name = name.trim();

    const user = await User.create({
      email: req.body.email,
      password: req.body.password,
      profile : {
        firstName : req.body.firstName,
        lastName : req.body.lastName,
        name : name
      }
    });

    await user.sendEmailVerification(req.protocol, req.hostname, req.body.returnTo);

    req.logIn(user, async (err) => {
      if (err) {
        return res.status(500).json({
          status: 'error',
          message: `Failed to log in new user. ${err.message}`
        });
      }
      res.json(await user.toCookieJson());
    });
  });

  app.get('/logout', logout)

  // Logout from React
  app.get(AuthEndpoint.logout, logout);
};
