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

const crawlRoutes = require('@conjurelabs/route/sync-crawl')

module.exports = {
  routes: crawlRoutes(path.resolve(__dirname, 'routes'))
}

log.timeEnd('finished setup')
