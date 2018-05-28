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
  secure: false,
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
    if (req.url === '/aws/ping' && req.headers['user-agent'] === 'ELB-HealthChecker/2.0') {
      return next()
    }
    if (req.headers && req.headers['x-forwarded-proto'] === 'https') {
      return next()
    }
    res.redirect(`${config.app.api.url}${req.url}`)
  })
  server.use(forcedHttpsRouter)
}

const forcedRedirectRouter = express.Router()
forcedRedirectRouter.get('*', (req, res, next) => {
  // aws healthcheck allow through, regardless
  if (req.url === '/aws/ping' && req.headers['user-agent'] === 'ELB-HealthChecker/2.0') {
    return next()
  }

  let acceptedProtocol = false
  let acceptedHost = false

  if (req.headers) {
    if (req.headers['x-forwarded-proto'] === config.app.api.protocol) {
      acceptedProtocol = true
    }
    if (req.headers.host === config.app.api.host) {
      acceptedHost = true
    }
  }

  if (acceptedProtocol && acceptedHost) {
    return next()
  }

  res.redirect(`${config.app.api.url}${req.url}`)
})
server.use(forcedRedirectRouter)

passport.use(
  new GitHubStrategy(
    {
      clientID: config.services.github.oauth.id,
      clientSecret: config.services.github.oauth.secret,
      scope: 'repo,user:email',
      state: true
    },

    async function(accessToken, refreshToken, profile, callback) {
      const { DatabaseTable } = require('@conjurelabs/db')
      const saveVisibleAccountRepos = require('./save-visible-repos')

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

        // update access token
        await githubAccount
          .set({
            accessToken
          })
          .save()

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

        if (Array.isArray(profile.emails)) {
          ensureEmailsStored(account, profile.emails.map(emailObj => {
            return emailObj.value
          }))
        }

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
          email: Array.isArray(profile.emails) && profile.emails.length ? profile.emails[0].value : null,
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
          email: Array.isArray(profile.emails) && profile.emails[0] ? profile.emails[0].value : null,
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

      if (Array.isArray(profile.emails)) {
        ensureEmailsStored(account, profile.emails.map(emailObj => {
          return emailObj.value
        }))
      }

      try {
        await saveVisibleAccountRepos(account, githubAccount)
      } catch(err) {
        log.error(err)
        account.requiresInstallation = true
      }

      callback(null, account)
      try {
        slackNotifySignup(account)
      } catch(err) {}
    }
  )
)

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

function slackNotifySignup(account) {
  if (process.env.NODE_ENV !== 'production') {
    return
  }

  const request = require('request')
  request({
    url: 'https://hooks.slack.com/services/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',
    method: 'POST',
    json: true,
    body: {
      channel: '#conjure-signups',
      username: 'Conjure API',
      text: 'User signed up',
      icon_emoji: ':conjure:',
      attachments: [{
        fields: [{
          title: 'Account Id',
          value: account.id,
          short: true
        }]
      }]
    }
  }, (err, res, body) => {
    if (err) {
      log.error(err)
    } else if (res.statusCode !== 200) {
      log.error(new ConjureError(body))
    }
  })
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

  const originalCookieMethod = res.cookie
  res.cookie = (name, data, options = {}) => {
    originalCookieMethod.call(res, name, data, {
      domain: process.env.NODE_ENV === 'production' ? '.conjure.sh' : `.${config.app.api.domain}`,
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 30,
      path: '/',
      sameSite: 'lax',
      ...options
    })
  }

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
