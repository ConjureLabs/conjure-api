require('@conjurelabs/utils/process/handle-exceptions')

// first running any synchronous setup
const setup = require('./setup')

const config = require('conjure-core/modules/config')
const express = require('express')
const compression = require('compression')
const cookieSession = require('cookie-session')
const morgan = require('morgan')
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')
const passport = require('passport')
const GitHubStrategy = require('passport-github').Strategy
const log = require('conjure-core/modules/log')()
const { ConjureError, ContentError, NotFoundError } = require('@conjurelabs/err')

const port = config.app.api.port
const server = express()

if (process.env.NODE_ENV !== 'production') {
  Error.stackTraceLimit = Infinity
}
process.env.TZ = 'America/Los_Angeles'

server.use(compression())
server.set('port', port)
server.use(morgan('combined'))

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
}))

server.use(passport.initialize())
server.use(passport.session())
server.use(bodyParser.urlencoded({
  extended: true
}))
server.use(bodyParser.json())
server.use(cookieParser())

passport.serializeUser((user, done) => {
  const { DatabaseRow } = require('@conjurelabs/db')
  console.log('serializeUser', user)
  done(null, new DatabaseRow('account', user))
})
passport.deserializeUser((user, done) => {
  console.log('deserializeUser', user)
  done(null, user)
})

if (config.app.api.protocol === 'https') {
  const forcedHttpsRouter = express.Router()
  forcedHttpsRouter.get('*', (req, res, next) => {
    if (req.headers && req.headers['x-forwarded-proto'] === 'https') {
      return next()
    }
    res.redirect(`${config.app.api.url}${req.url}`)
  })
  server.use(forcedHttpsRouter)
}

passport.use(
  new GitHubStrategy(
    {
      clientID: config.services.github.oauth.id,
      clientSecret: config.services.github.oauth.secret,
      // callbackURL: `${config.app.api.url}/auth/github/callback`,
      scope: 'repo,user:email',
      state: true
    },

    async function(accessToken, refreshToken, profile, callback) {
      const { DatabaseTable } = require('@conjurelabs/db')

      if (!profile.id || isNaN(parseInt(profile.id, 10))) {
        return callback(new ContentError('Github Id was not present in profile json'))
      }

      let githubAccountRows

      try {
        // check for existing account record
        githubAccountRows = await DatabaseTable.select('accountGithub', {
          githubId: profile.id
        })
      } catch(err) {
        return callback(err)
      }

      // have logged in using github before...
      if (githubAccountRows.length) {
        const githubAccount = githubAccountRows[0]

        let accountRows
        try {
          // finding associated conjure account
          accountRows = await DatabaseTable.select('account', {
            id: githubAccount.account
          })
        } catch(err) {
          return callback(err)
        }

        // this should not happen, since the conjure account showed the associated id
        if (!accountRows.length) {
          return callback(new NotFoundError('Conjure account record not found for associated Github account'))
        }

        const account = accountRows[0]

        // record the login
        try {
          await DatabaseTable.insert('accountLogin', {
            account: account.id,
            service: DatabaseTable.cast('github', 'account_login_service'),
            added: DatabaseTable.literal('NOW()')
          })
        } catch(err) {
          log.error(err)
        }

        // making sure some details on the github account table are up-to-date

        ensureEmailsStored(account, profile.emails.map(emailObj => {
          return emailObj.value
        }))

        githubAccount.photo = Array.isArray(profile.photos) && profile.photos[0] ? profile.photos[0].value : null
        githubAccount.updated = new Date()
        
        try {
          await githubAccount.save()
        } catch(err) {
          return callback(err)
        }

        try {
          await saveVisibleAccountRepos(account, githubAccount)
        } catch(err) {
          log.error(err)
          account.requiresInstallation = true
        }
        return callback(null, account)
      }

      // todo: deal with github logins where account record already exists,
      // since the user logged in with another service
      // (need to lookup other records on email?)
      // (should we even do this?)
    
      // need a conjure account
      let accountRows
      try {
        accountRows = await DatabaseTable.insert('account', {
          name: profile.displayName,
          email: profile.emails[0].value,
          onboarded: false,
          added: DatabaseTable.literal('NOW()')
        })
      } catch(err) {
        return callback(err)
      }

      const account = accountRows[0]

      // console.log(profile)

      try {
        // already defined at start of this func
        githubAccountRows = await DatabaseTable.insert('accountGithub', {
          githubId: profile.id,
          account: account.id,
          username: profile.username,
          name: profile.displayName,
          email: profile.emails[0].value,
          photo: Array.isArray(profile.photos) && profile.photos[0] ? profile.photos[0].value : null,
          accessToken: accessToken,
          accessTokenAssumedValid: true,
          added: DatabaseTable.literal('NOW()')
        })
      } catch(err) {
        return callback(err)
      }

      const githubAccount = githubAccountRows[0]

      // record the login
      try {
        await DatabaseTable.insert('accountLogin', {
          account: account.id,
          service: DatabaseTable.cast('github', 'account_login_service'),
          added: DatabaseTable.literal('NOW()')
        })
      } catch(err) {
        log.error(err)
      }

      ensureEmailsStored(account, profile.emails.map(emailObj => {
        return emailObj.value
      }))

      try {
        await saveVisibleAccountRepos(account, githubAccount)
      } catch(err) {
        log.error(err)
        account.requiresInstallation = true
      }

      callback(null, account)
    }
  )
)

// todo: re-save on a cron
async function saveVisibleAccountRepos(account, githubAccount) {
  const { DatabaseTable } = require('@conjurelabs/db')

  const GitHubAPI = require('conjure-core/classes/GitHub/API/App')
  const api = new GitHubAPI()

  // see https://developer.github.com/v3/apps/#list-installations-for-user
  /*
    sample output:
    [ { id: 176296,
    account: 
     { login: 'ConjureLabs',
       id: 1783213,
       avatar_url: 'https://avatars1.githubusercontent.com/u/1783213?v=4',
       gravatar_id: '',
       url: 'https://api.github.com/users/ConjureLabs',
       html_url: 'https://github.com/ConjureLabs',
       followers_url: 'https://api.github.com/users/ConjureLabs/followers',
       following_url: 'https://api.github.com/users/ConjureLabs/following{/other_user}',
       gists_url: 'https://api.github.com/users/ConjureLabs/gists{/gist_id}',
       starred_url: 'https://api.github.com/users/ConjureLabs/starred{/owner}{/repo}',
       subscriptions_url: 'https://api.github.com/users/ConjureLabs/subscriptions',
       organizations_url: 'https://api.github.com/users/ConjureLabs/orgs',
       repos_url: 'https://api.github.com/users/ConjureLabs/repos',
       events_url: 'https://api.github.com/users/ConjureLabs/events{/privacy}',
       received_events_url: 'https://api.github.com/users/ConjureLabs/received_events',
       type: 'Organization',
       site_admin: false },
    repository_selection: 'all',
    access_tokens_url: 'https://api.github.com/installations/176296/access_tokens',
    repositories_url: 'https://api.github.com/installation/repositories',
    html_url: 'https://github.com/organizations/ConjureLabs/settings/installations/176296',
    app_id: 12174,
    target_id: 1783213,
    target_type: 'Organization',
    permissions: 
     { pull_requests: 'write',
       contents: 'read',
       single_file: 'read',
       metadata: 'read' },
    events: [ 'pull_request' ],
    created_at: '2018-05-15T01:28:47.000Z',
    updated_at: '2018-05-15T01:28:48.000Z',
    single_file_name: '/.conjure/config.yml' } ]
   */
  const installations = await api.request({
    path: '/app/installations',
    qs: {
      access_token: githubAccount.accessToken
    }
  })

  if (installations.length === 0) {
    account.requiresInstallation = true
    return
  }

  // saving installations
  const installSummary = await saveInstallationRecords(installations)
  await installInstallRepos(api, installSummary, githubAccount)
}

async function saveInstallationRecords(installations) {
  const { DatabaseTable } = require('@conjurelabs/db')

  // see https://developer.github.com/v3/apps/#list-installations-for-user
  /*
    sample output:
    [ { id: 176296,
    account: 
     { login: 'ConjureLabs',
       id: 1783213,
       avatar_url: 'https://avatars1.githubusercontent.com/u/1783213?v=4',
       gravatar_id: '',
       url: 'https://api.github.com/users/ConjureLabs',
       html_url: 'https://github.com/ConjureLabs',
       followers_url: 'https://api.github.com/users/ConjureLabs/followers',
       following_url: 'https://api.github.com/users/ConjureLabs/following{/other_user}',
       gists_url: 'https://api.github.com/users/ConjureLabs/gists{/gist_id}',
       starred_url: 'https://api.github.com/users/ConjureLabs/starred{/owner}{/repo}',
       subscriptions_url: 'https://api.github.com/users/ConjureLabs/subscriptions',
       organizations_url: 'https://api.github.com/users/ConjureLabs/orgs',
       repos_url: 'https://api.github.com/users/ConjureLabs/repos',
       events_url: 'https://api.github.com/users/ConjureLabs/events{/privacy}',
       received_events_url: 'https://api.github.com/users/ConjureLabs/received_events',
       type: 'Organization',
       site_admin: false },
    repository_selection: 'all',
    access_tokens_url: 'https://api.github.com/installations/176296/access_tokens',
    repositories_url: 'https://api.github.com/installation/repositories',
    html_url: 'https://github.com/organizations/ConjureLabs/settings/installations/176296',
    app_id: 12174,
    target_id: 1783213,
    target_type: 'Organization',
    permissions: 
     { pull_requests: 'write',
       contents: 'read',
       single_file: 'read',
       metadata: 'read' },
    events: [ 'pull_request' ],
    created_at: '2018-05-15T01:28:47.000Z',
    updated_at: '2018-05-15T01:28:48.000Z',
    single_file_name: '/.conjure/config.yml' } ]
   */
  const batchAll = require('@conjurelabs/utils/Promise/batch-all')
  const installationRecords = await batchAll(4, installations, install => {
    const { id, account } = install
    const now = new Date()
    return DatabaseTable.upsert('githubAppInstallation', {
      githubId: account.id,
      username: account.login,
      githubAccountType: account.target_type,
      installationId: id,
      photo: account.avatar_url,
      lastVerifiedActive: now,
      added: now
    }, {
      username: account.login,
      githubAccountType: account.target_type,
      photo: account.avatar_url,
      lastVerifiedActive: now,
      updated: now
    }, {
      installationId: id
    })
  })

  const installedAppsSummary = installationRecords.map(install => ({
    username: install.username,
    installationId: install.installationId
  }))

  return installedAppsSummary
}

async function installInstallRepos(api, installSummary, githubAccount) {
  /*
    install --> [{ username:, installationId: }]
   */
  const { DatabaseTable, query } = require('@conjurelabs/db')
  const uuidv4 = require('uuid/v4') // using uuid to track fresh installs, so prune will be easy
  
  const verificationIdentifier = uuidv4()
  const accountRepo = new DatabaseTable('accountRepo')

  for (let install of installSummary) {
    // see https://developer.github.com/v3/apps/installations/#list-repositories
    let reposResult = await api.request({
      path: '/installation/repositories'
    })

    const allRepos = reposResult.repositories
    while (reposResult.next) {
      reposResult = await api.request({
        path: reposResult.next
      })
      if (!reposResult.repositories.length) {
        break
      }
      allRepos.push(...reposResult.repositories)
    }

    // run upserts
    const batchAll = require('@conjurelabs/utils/Promise/batch-all')
    await batchAll(3, allRepos, repo => {
      console.log(`UPSERTING ${repo.org} / ${repo.name}`)
      return accountRepo.upsert({
        // insert
        account: githubAccount.account,
        service: 'github',
        serviceRepoId: repo.id,
        url: repo.url,
        org: repo.org,
        name: repo.name,
        accessRights: repo.permissions && repo.permissions.push === true ? 'rw' : 'r',
        private: repo.private === true,
        verificationIdentifier,
        added: new Date()
      }, {
        // update
        url: repo.url,
        org: repo.org,
        name: repo.name,
        accessRights: repo.permissions && repo.permissions.push === true ? 'rw' : 'r',
        private: repo.private === true,
        verificationIdentifier,
        updated: new Date()
      }, {
        // update where
        account: githubAccount.account,
        service: 'github',
        serviceRepoId: repo.id
      })
    })

    // prune out the old ids, that are apparently no longer visible
    await query(`
      DELETE FROM account_repo
      WHERE account = $1
      AND service = 'github'
      AND verification_identifier != $2
    `, [githubAccount.account, verificationIdentifier])
  }
}

async function ensureEmailsStored(account, seenEmails) {
  const { DatabaseTable } = require('@conjurelabs/db')
  const accountEmails = new DatabaseTable('accountEmail')

  let rows
  try {
    rows = await accountEmails.select({
      account: account.id
    })
  } catch(err) {
    log.error(err)
    return
  }

  const alreadyHave = rows.map(row => row.email)
  const pendingEmails = seenEmails.filter(email => !alreadyHave.includes(email))

  for (let i = 0; i < pendingEmails.length; i++) {
    try {
      await accountEmails.insert({
        account: account.id,
        email: pendingEmails[i],
        added: new Date()
      })
    } catch(err) {
      log.error(err)
    }
  }
}

server.use((req, res, next) => {
  res.header('Access-Control-Allow-Credentials', true)
  res.header('Access-Control-Allow-Origin', req.headers.origin)
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE')
  res.header('Access-Control-Allow-Headers', 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept')
  next()
})

server.use((req, res, next) => {
  req.state = {} // used to track anything useful, along the lifetime of a request
  req.state.remoteAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress

  next()
})

server.use((req, res, next) => {
  const { cipherAlgorithm, cipherSecret, hmacAlgorithm, hmacSecret } = config.cookies.secure

  const signedEncryption = require('@conjurelabs/utils/crypto/signed-encryption')
  const encryptor = signedEncryption(cipherAlgorithm, cipherSecret).withHmac(hmacAlgorithm, hmacSecret)

  res.cookieSecure = (name, data, ...extraArgs) => {
    if (typeof data !== 'string') {
      throw new ContentError('expected string for res.cookieSecure()')
    }

    res.cookie(name, encryptor.encrypt(data), ...extraArgs)
  }

  req.cookieSecure = name => {
    const cookieVal = req.cookies[name]
    if (!cookieVal) {
      return cookieVal
    }

    let decrypted

    try {
      decrypted = encryptor.decrypt(cookieVal)
    } catch(err) {
      log.error(err)
      return undefined
    }

    return decrypted
  }

  next()
})

// if user has bad cookie, kick 'um
server.use(async (req, res, next) => {
  if (!req.isAuthenticated()) {
    return next()
  }

  if (isNaN(req.user.id)) {
    req.logout()
    return next()
  }

  const { DatabaseTable } = require('@conjurelabs/db')

  // check for existing account record
  let rows
  try {
    rows = await DatabaseTable.select('account', {
      id: req.user.id
    })
  } catch(err) {
    return next(err)
  }

  if (!rows.length) {
    log.info('User forced logout -- bad cookie')
    req.logout()
  }

  next()
})

server.use(setup.routes)

server.use((err, req, res, next) => {
  if (!err) {
    return next()
  }

  log.error(err)

  // logging github errors if we have them
  if (err.body && Array.isArray(err.errors)) {
    console.dir(err.errors)
  }

  if (err instanceof ConjureError) {
    return res
      .status(err.httpStatusCode)
      .send({
        message: err.friendlyError
      })
  }

  res
    .status(500)
    .send({
      message: 'An error occurred'
    })
})

server.listen(port, () => {
  log.info(`listening on :${port}`)
})
