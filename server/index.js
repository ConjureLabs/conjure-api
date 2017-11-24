require('conjure-core/modules/utils/process/handle-exceptions');

// first running any synchronous setup
const setup = require('./setup');

const config = require('conjure-core/modules/config');
const express = require('express');
const compression = require('compression');
const cookieSession = require('cookie-session');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const passport = require('passport');
const GitHubStrategy = require('passport-github').Strategy;
const log = require('conjure-core/modules/log')();
const { ConjureError, ContentError, NotFoundError } = require('conjure-core/modules/err');

const port = config.app.api.port;
const server = express();

if (process.env.NODE_ENV !== 'production') {
  Error.stackTraceLimit = Infinity;
}
process.env.TZ = 'America/Los_Angeles';

server.use(compression());
server.set('port', port);
server.use(morgan('combined'));

server.use(cookieSession({
  name: 'conjure',
  secret: config.session.secret,

  // cookie options
  domain: process.env.NODE_ENV === 'production' ? '.conjure.sh' : `.${config.app.api.domain}`,
  httpOnly: true,
  maxAge: config.session.duration,
  overwrite: true,
  sameSite: 'lax',
  secure: config.app.api.protocol === 'https',
  signed: true
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
  console.log('serializeUser', user);
  done(null, new DatabaseRow('account', user));
});
passport.deserializeUser((user, done) => {
  console.log('deserializeUser', user);
  done(null, user);
});

if (config.app.api.protocol === 'https') {
  const forcedHttpsRouter = express.Router();
  forcedHttpsRouter.get('*', (req, res, next) => {
    if (req.headers && req.headers['x-forwarded-proto'] === 'https') {
      return next();
    }
    res.redirect(`${config.app.api.url}${req.url}`);
  });
  server.use(forcedHttpsRouter);
}

passport.use(
  new GitHubStrategy(
    {
      clientID: config.services.github.id,
      clientSecret: config.services.github.secret,
      callbackURL: `${config.app.api.url}/auth/github/callback`,
      scope: 'repo,admin:public_key,user:email,write:repo_hook,admin:org_hook'
    },

    async function(accessToken, refreshToken, profile, callback) {
      const DatabaseTable = require('conjure-core/classes/DatabaseTable');

      if (!profile.id || isNaN(parseInt(profile.id, 10))) {
        return callback(new ContentError('Github Id was not present in profile json'));
      }

      let githubAccountRows;

      try {
        // check for existing account record
        githubAccountRows = await DatabaseTable.select('account_github', {
          github_id: profile.id
        });
      } catch(err) {
        return callback(err);
      }

      // have logged in using github before...
      if (githubAccountRows.length) {
        const githubAccount = githubAccountRows[0];

        let accountRows;
        try {
          // finding associated conjure account
          accountRows = await DatabaseTable.select('account', {
            id: githubAccount.account
          });
        } catch(err) {
          return callback(err);
        }

        // this should not happen, since the conjure account showed the associated id
        if (!accountRows.length) {
          return callback(new NotFoundError('Conjure account record not found for associated Github account'));
        }

        const account = accountRows[0];

        callback(null, account);

        // record the login
        try {
          await DatabaseTable.insert('account_login', {
            account: account.id,
            service: DatabaseTable.cast('github', 'account_login_service'),
            added: DatabaseTable.literal('NOW()')
          });
        } catch(err) {
          log.error(err);
        }

        // making sure some details on the github account table are up-to-date

        ensureEmailsStored(account, profile.emails.map(emailObj => {
          return emailObj.value;
        }));

        githubAccount.photo = Array.isArray(profile.photos) && profile.photos[0] ? profile.photos[0].value : null;
        githubAccount.updated = new Date();
        
        try {
          await githubAccount.save();
        } catch(err) {
          log.error(err);
          return;
        }

        try {
          saveVisibleAccountRepos(githubAccount);
        } catch(err) {
          log.error(err);
        }
        return;
      }

      // todo: deal with github logins where account record already exists,
      // since the user logged in with another service
      // (need to lookup other records on email?)
      // (should we even do this?)
    
      // need a conjure account
      let accountRows;
      try {
        accountRows = await DatabaseTable.insert('account', {
          name: profile.displayName,
          email: profile.emails[0].value,
          onboarded: false,
          added: DatabaseTable.literal('NOW()')
        });
      } catch(err) {
        return callback(err);
      }

      const account = accountRows[0];

      console.log(profile);

      try {
        // already defined at start of this func
        githubAccountRows = await DatabaseTable.insert('account_github', {
          github_id: profile.id,
          account: account.id,
          username: profile.username,
          name: profile.displayName,
          email: profile.emails[0].value,
          photo: Array.isArray(profile.photos) && profile.photos[0] ? profile.photos[0].value : null,
          access_token: accessToken,
          added: DatabaseTable.literal('NOW()')
        });
      } catch(err) {
        return callback(err);
      }

      const githubAccount = githubAccountRows[0];

      callback(null, account);

      // record the login
      try {
        await DatabaseTable.insert('account_login', {
          account: account.id,
          service: DatabaseTable.cast('github', 'account_login_service'),
          added: DatabaseTable.literal('NOW()')
        });
      } catch(err) {
        log.error(err);
      }

      ensureEmailsStored(account, profile.emails.map(emailObj => {
        return emailObj.value;
      }));

      try {
        saveVisibleAccountRepos(githubAccount);
      } catch(err) {
        log.error(err);
      }
    }
  )
);

// todo: re-save on a daily cron
async function saveVisibleAccountRepos(githubAccount) {
  const apiGetRepos = require('./routes/api/repos/get.js').call;
  
  const userRepos = await apiGetRepos({
    user: {
      id: githubAccount.account
    }
  });

  const allRepos = [];

  const DatabaseTable = require('conjure-core/classes/DatabaseTable');
  const accountRepo = new DatabaseTable('account_repo');

  const reposByOrg = userRepos.reposByOrg;

  for (let org in reposByOrg) {
    for (let i = 0; i < reposByOrg[org].length; i++) {
      const repo = reposByOrg[org][i];

      // push upsert func
      allRepos.push(repo);
    }
  }

  console.log(allRepos.map(r => ({
    id: r.id,
    name: r.name,
    org: r.org,
    url: r.url
  })))

  // run upserts
  const batchAll = require('conjure-core/modules/utils/Promise/batch-all');
  await batchAll(3, allRepos, repo => {
    console.log(`UPSERTING ${repo.org} / ${repo.name}`);
    return accountRepo.upsert({
      // insert
      account: githubAccount.account,
      service: repo.service.toLowerCase(),
      service_repo_id: repo.id,
      url: repo.url,
      org: repo.org,
      name: repo.name,
      access_rights: repo.permissions && repo.permissions.push === true ? 'rw' : 'r',
      private: repo.private === true,
      added: new Date()
    }, {
      // update
      url: repo.url,
      org: repo.org,
      name: repo.name,
      access_rights: repo.permissions && repo.permissions.push === true ? 'rw' : 'r',
      private: repo.private === true,
      updated: new Date()
    }, {
      // update where
      account: githubAccount.account,
      service: repo.service.toLowerCase(),
      service_repo_id: repo.id
    });
  });

  const repoIds = allRepos.map(repo => repo.id);

  // preparing args for account_repo pruning
  const repoIdsListed = repoIds
    .map((_, i) => {
      return `$${i + 2}`;
    })
    .join(', ');
  const pruningArgs = [githubAccount.account, ...repoIds];

  // prune out the old ids, that are apparently no longer visible
  const database = require('conjure-core/modules/database');
  await database.query(`
    DELETE FROM account_repo
    WHERE account = $1
    AND service = 'github'
    AND service_repo_id NOT IN (${repoIdsListed})
  `, pruningArgs);
}

async function ensureEmailsStored(account, seenEmails) {
  const DatabaseTable = require('conjure-core/classes/DatabaseTable');
  const accountEmails = new DatabaseTable('account_email');

  let rows;
  try {
    rows = await accountEmails.select({
      account: account.id
    });
  } catch(err) {
    log.error(err);
    return;
  }

  const alreadyHave = rows.map(row => row.email);
  const pendingEmails = seenEmails.filter(email => !alreadyHave.includes(email));

  for (let i = 0; i < pendingEmails.length; i++) {
    try {
      await accountEmails.insert({
        account: account.id,
        email: pendingEmails[i],
        added: new Date()
      });
    } catch(err) {
      log.error(err);
    }
  }
}

server.use((req, res, next) => {
  res.header('Access-Control-Allow-Credentials', true);
  res.header('Access-Control-Allow-Origin', req.headers.origin);
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header('Access-Control-Allow-Headers', 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept');
  next();
});

server.use((req, res, next) => {
  req.state = {}; // used to track anything useful, along the lifetime of a request
  req.state.remoteAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  next();
});

// if user has bad cookie, kick 'um
server.use(async (req, res, next) => {
  if (!req.isAuthenticated()) {
    return next();
  }

  if (isNaN(req.user.id)) {
    req.logout();
    return next();
  }

  const DatabaseTable = require('conjure-core/classes/DatabaseTable');

  // check for existing account record
  let rows;
  try {
    rows = await DatabaseTable.select('account', {
      id: req.user.id
    });
  } catch(err) {
    return next(err);
  }

  if (!rows.length) {
    log.info('User forced logout -- bad cookie');
    req.logout();
  }

  next();
});

server.use(setup.routes.api);
server.use(setup.routes.auth);
server.use(setup.routes.debug);
server.use(setup.routes.hook);
server.use(setup.routes.aws);

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
    .send({
      message: 'An error occurred'
    });
});

server.listen(port, () => {
  log.info(`listening on :${port}`);
});
