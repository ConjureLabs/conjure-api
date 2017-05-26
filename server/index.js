// first running any synchronous setup
const setup = require('./setup');

const config = require('conjure-core/modules/config');
const express = require('express');
const compression = require('compression');
const cookieSession = require('cookie-session');
const morgan = require('morgan');
const path = require('path');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const passport = require('passport');
const GitHubStrategy = require('passport-github').Strategy;
const log = require('conjure-core/modules/log')();
const ConjureError = require('conjure-core/modules/err').ConjureError;
const NotFoundError = require('conjure-core/modules/err').NotFoundError;
const ContentError = require('conjure-core/modules/err').ContentError;

const port = config.app.api.port;
const server = express();

if (process.env.NODE_ENV !== 'production') {
  Error.stackTraceLimit = Infinity;
}
process.env.TZ = 'America/Los_Angeles';

// log fatal exceptions
process.on('uncaughtException', err => {
  if (err.message) {
    console.error('Caught exception (message): ', err.message);
  }
  if (err.stack) {
    console.error('Caught exception (stack): ', err.stack);
  }
  if (!err.message && !err.stack) {
    console.error('Caught exception:', err);
  }

  process.nextTick(() => {
    process.exit();
  });
});

server.use(compression());
server.set('port', port);
server.use(morgan('combined'));

server.use(cookieSession({
  cookieName: 'conjure',
  secret: config.session.secret,
  duration: config.session.duration,
  cookie: {
    httpOnly: true,
    secure: config.app.api.protocol === 'https'
  }
}));

server.use(passport.initialize());
server.use(passport.session());
server.use(bodyParser.urlencoded({
  extended: true
}));
server.use(bodyParser.json());
server.use(cookieParser());

passport.serializeUser((user, done) => {
  const DatabaseRow = require('conjure-core/classes/DatabaseRow');
  done(null, new DatabaseRow('account', user));
});
passport.deserializeUser((user, done) => {
  done(null, user);
});

passport.use(
  new GitHubStrategy(
    {
      clientID: config.services.github.id,
      clientSecret: config.services.github.secret,
      callbackURL: `${config.app.api.url}/auth/github/callback`,
      scope: 'repo,admin:public_key,user:email,write:repo_hook,admin:org_hook'
    },

    function(accessToken, refreshToken, profile, callback) {
      const DatabaseTable = require('conjure-core/classes/DatabaseTable');

      if (!profile.id || isNaN(parseInt(profile.id, 10))) {
        return callback(new ContentError('Github Id was not present in profile json'));
      }

      // check for existing account record
      DatabaseTable.select('account_github', {
        github_id: profile.id
      }, (err, rows) => {
        if (err) {
          return callback(err);
        }

        // have logged in using github before...
        if (rows.length === 1) {
          const githubAccount = rows[0];

          // finding associated conjure account
          DatabaseTable.select('account', {
            id: githubAccount.account
          }, (err, rows) => {
            if (err) {
              return callback(err);
            }

            // this should not happen, since the conjure account showed the associated id
            if (!rows.length) {
              return callback(new NotFoundError('Conjure account record not found for associated Github account'));
            }

            const account = rows[0];

            callback(err, account);

            // record the login
            DatabaseTable.insert('account_login', {
              account: account.id,
              service: DatabaseTable.cast('github', 'account_login_service'),
              added: DatabaseTable.literal('NOW()')
            }, err => {
              if (err) {
                log.error(err);
              }
            });

            // making sure some details on the github account table are up-to-date

            ensureEmailsStored(account, profile.emails.map(emailObj => {
              return emailObj.value;
            }));

            githubAccount.photo = Array.isArray(profile.photos) && profile.photos[0] ? profile.photos[0].value : null;
            githubAccount.save(err => {
              if (err) {
                log.error(err);
              }
            });
          });
          return;
        }

        // todo: deal with github logins where account record already exists,
        // since the user logged in with another service
        // (need to lookup other records on email?)
        
        // need a conjure account
        DatabaseTable.insert('account', {
          name: profile.displayName,
          email: profile.emails[0].value,
          added: DatabaseTable.literal('NOW()')
        }, (err, rows) => {
          const account = rows[0];

          console.log(profile);

          DatabaseTable.insert('account_github', {
            github_id: profile.id,
            account: account.id,
            username: profile.username,
            name: profile.displayName,
            email: profile.emails[0].value,
            photo: Array.isArray(profile.photos) && profile.photos[0] ? profile.photos[0].value : null,
            access_token: accessToken,
            added: DatabaseTable.literal('NOW()')
          }, err => {
              if (err) {
                return callback(err);
              }

              callback(err, account);

              // record the login
              DatabaseTable.insert('account_login', {
                account: account.id,
                service: DatabaseTable.cast('github', 'account_login_service'),
                added: DatabaseTable.literal('NOW()')
              }, err => {
                if (err) {
                  log.error(err);
                }
              });

              ensureEmailsStored(account, profile.emails.map(emailObj => {
                return emailObj.value;
              }));
            }
          );
        });
      });
    }
  )
);

function ensureEmailsStored(account, seenEmails) {
  const DatabaseTable = require('conjure-core/classes/DatabaseTable');
  const accountEmails = new DatabaseTable('account_email');

  accountEmails.select({
    account: account.id
  }, (err, rows) => {
    if (err) {
      log.error(err);
      return;
    }

    const alreadyHave = rows.map(row => row.email);
    const pendingEmails = seenEmails.filter(email => !alreadyHave.includes(email));

    for (let i = 0; i < accountEmails.length; i++) {
      accountEmails.insert({
        account: account.id,
        email: pendingEmails[i],
        added: new Date()
      }, err => {
        if (err) {
          log.error(err);
        }
      });
    }
  });
}

server.use((req, res, next) => {
  req.state = {}; // used to track anything useful, along the lifetime of a request
  req.state.remoteAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  next();
});

// if user has bad cookie, kick 'um
server.use((req, res, next) => {
  if (!req.isAuthenticated()) {
    return next();
  }

  if (isNaN(req.user.id)) {
    req.logout();
    return next();
  }

  const DatabaseTable = require('conjure-core/classes/DatabaseTable');

  // check for existing account record
  DatabaseTable.select('account', {
    id: req.user.id
  }, (err, rows) => {
    if (err) {
      return next(err);
    }

    if (!rows.length) {
      log.info('User forced logout -- bad cookie');
      req.logout();
    }

    next();
  });
});

server.use(setup.routes.api);
server.use(setup.routes.debug);
server.use(setup.routes.hook);

server.use((err, req, res, next) => {
  if (!err) {
    return next();
  }

  log.error(err);

  // logging github errors if we have them
  if (err.body && Array.isArray(err.errors)) {
    console.dir(err.errors);
  }

  if (err instanceof ConjureError) {
    return res
      .status(err.httpStatusCode)
      .send(err.friendlyError);
  }

  res
    .status(500)
    .send('An error occurred');
});

server.listen(port, () => {
  log.info(`listening on :${port}`);
});
