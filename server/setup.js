// allowing sync methods in this file only
// ... allowing sync in this file since it will only be run at startup, not during the lifetime of the app
/*eslint no-sync: 0*/

const path = require('path')
const config = require('conjure-core/modules/config')
const log = require('conjure-core/modules/log')()

log.info('beginning setup')
log.timeStart('finished setup')

// configure db connection
require('@conjurelabs/db').init(config.database.pg, {
  transformCamelCase: true
}, (sql, args) => {
  log.dev.info(sql, process.env.NODE_ENV === 'production' && args ? '---REDACTED---' : args)
})

const Route = require('@conjurelabs/route')

Route.defaultOptions = {
  cors: {
    credentials: true,
    methods: ['GET', 'PUT', 'PATCH', 'POST', 'DELETE', 'HEAD', 'OPTIONS'],
    optionsSuccessStatus: 200,
    origin: [
      config.app.api.url,
      config.app.web.url
    ],
    preflightContinue: true
  }
}

const crawlRoutes = require('@conjurelabs/route/sync-crawl')

module.exports = {
  routes: crawlRoutes(path.resolve(__dirname, 'routes'))
}

log.timeEnd('finished setup')
