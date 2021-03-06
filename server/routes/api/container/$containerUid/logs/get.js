const Route = require('@conjurelabs/route')
const { UnexpectedError } = require('@conjurelabs/err')
const config = require('conjure-core/modules/config')

const route = new Route({
  requireAuthentication: true
})

/*
  Container logs, getting the setup needed to connect via sockets
 */
route.push(async (req, res) => {
  const { orgName, containerUid } = req.params

  const { query } = require('@conjurelabs/db')

  // pulling 1 more than needed, to check if there are more results
  const result = await query(`
    SELECT c.domain
    FROM container c
    INNER JOIN watched_repo wr
      ON c.repo = wr.id
    WHERE c.url_uid = $1
    AND is_active IS TRUE
    AND wr.disabled IS FALSE
    AND wr.service_repo_id IN (
      SELECT service_repo_id
      FROM account_repo
      WHERE account = $2
    )
  `, [containerUid, req.user.id])

  // should not happen
  if (!Array.isArray(result.rows)) {
    throw new UnexpectedError('No rows returned')
  }

  const container = result.rows[0]
  const workerHost = container.domain.split('.').slice(1).join('.')

  const request = require('request-promise-native')
  const body = await request({
    method: 'POST',
    url: `${config.app.worker.protocol}://${workerHost}:${config.app.worker.port}/github/container/logs`,
    body: {
      orgName,
      containerUid
    },
    json: true
  })

  res.send({
    sessionKey: body.sessionKey,
    host: workerHost
  })
})

module.exports = route
