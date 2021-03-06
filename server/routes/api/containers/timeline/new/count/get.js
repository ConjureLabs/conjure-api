const Route = require('@conjurelabs/route')
const { ContentError, UnexpectedError } = require('@conjurelabs/err')

const route = new Route({
  requireAuthentication: true
})

/*
  New container timeline rows, since last reference (row id)
 */
route.push(async (req, res) => {
  const { org, repo } = req.query
  let { rel } = req.query

  rel = parseInt(rel, 10) // required - is most recent row id in existing timeline

  if (isNaN(rel)) {
    throw new ContentError('Missing `rel` (number)')
  }

  const { query } = require('@conjurelabs/db')

  const sqlArgs = []
  const sqlWheres = []

  if (org !== '*') {
    sqlWheres.push(`wr.org = $${sqlArgs.length + 1}`)
    sqlArgs.push(org)
  }

  if (repo !== '*') {
    sqlWheres.push(`wr.name = $${sqlArgs.length + 1}`)
    sqlArgs.push(repo)
  }

  // records associated to user
  sqlWheres.push(`wr.service_repo_id IN ( SELECT service_repo_id FROM account_repo WHERE account = $${sqlArgs.length + 1} )`)
  sqlArgs.push(req.user.id)

  // offset check, based on relation of last id seen by client
  sqlWheres.push(`c.id > $${sqlArgs.length + 1}`)
  sqlArgs.push(rel)

  const result = await query(`
    SELECT COUNT(*) num
    FROM container c
    INNER JOIN watched_repo wr ON c.repo = wr.id
    WHERE wr.disabled IS FALSE
    AND ${sqlWheres.join(`
      AND
    `)}
  `, sqlArgs)

  // should not happen
  if (!Array.isArray(result.rows)) {
    throw new UnexpectedError('No rows returned')
  }

  res.send({
    count: result.rows[0].num
  })
})

module.exports = route
