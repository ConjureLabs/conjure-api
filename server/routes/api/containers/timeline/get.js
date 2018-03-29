const Route = require('@conjurelabs/route')
const { ContentError, UnexpectedError } = require('@conjurelabs/err')
const config = require('conjure-core/modules/config')

const route = new Route({
  requireAuthentication: true
})

const webConfig = config.app.web

/*
  Container timeline
 */
route.push(async (req, res) => {
  const { org, repo } = req.query
  let { page, rel } = req.query

  page = parseInt(page, 10) // required
  rel = parseInt(rel, 10) // may be NaN, if page = 1

  const limit = 32 // todo: config this?

  if (isNaN(page) || page < 0) {
    throw new ContentError('Missing page number')
  } else if (page > 1 && isNaN(rel)) {
    throw new ContentError('Must pass `rel` if paging')
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

  // if using paging rel (relative row id that marks row 0) then we must page against that row
  if (rel) {
    sqlWheres.push(`c.id <= $${sqlArgs.length + 1}`)
    sqlArgs.push(rel)
  }

  // pulling 1 more than needed, to check if there are more results
  const result = await query(`
    SELECT
      c.*,
      wr.name repo_name,
      wr.private repo_private
    FROM container c
    INNER JOIN watched_repo wr ON c.repo = wr.id
    WHERE ${sqlWheres.join(`
      AND
    `)}
    ORDER BY added DESC
    LIMIT ${limit + 1}
    OFFSET ${page * limit}
  `, sqlArgs)

  // should not happen
  if (!Array.isArray(result.rows)) {
    throw new UnexpectedError('No rows returned')
  }

  const moreRows = result.rows.length > limit
  if (moreRows) {
    result.rows.pop() // taking off extra row, which was used as an indicator
  }

  if (isNaN(rel) && result.rows.length) {
    rel = result.rows[0].id
  }

  const timeline = result.rows.map(row => {
    return {
      id: row.id,
      repo: row.repoName,
      repoPrivate: row.repoPrivate,
      branch: row.branch,
      view: `${webConfig.protocol}://${row.urlUid}.view.${webConfig.host}`,
      logs: `${webConfig.protocol}://${row.urlUid}.logs.${webConfig.host}`,
      status: row.isActive === true && !row.activeStart ? 'Spinning Up' :
        row.isActive === true && row.activeStart ? 'Running' :
        row.isActive === false ? 'Spun Down' :
        'Unknown', // should not happen
      start: row.activeStart || row.added,
      stop: row.activeStop
    }
  })

  const qs = require('qs')

  res.send({
    timeline,
    paging: {
      prev: page === 0 ? null : `${config.app.api.url}/api/containers/timeline?${qs.stringify({
        org,
        repo,
        page: page - 1,
        rel
      })}`,

      next: !moreRows ? null : `${config.app.api.url}/api/containers/timeline?${qs.stringify({
        org,
        repo,
        page: page + 1,
        rel
      })}`
    },
    delta: `${config.app.api.url}/api/containers/timeline/new/count?${qs.stringify({
      org,
      repo,
      rel: isNaN(rel) ? 0 : rel
    })}`
  })
})

module.exports = route
