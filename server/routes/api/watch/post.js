const Route = require('@conjurelabs/route')
const { ContentError } = require('@conjurelabs/err')

const route = new Route({
  requireAuthentication: true
})

route.push(async (req, res) => {
  if (!Array.isArray(req.body)) {
    throw new ContentError('Payload missing or in an unexpected format')
  }

  // getting all user repos
  const apiGetRepos = require('../repos/get.js').call
  const apiGetReposResult = apiGetRepos(req)
  const { reposByOrg } = await apiGetReposResult

  // filtering down to repos selected
  const repos = []
  const orgs = Object.keys(reposByOrg)
  const selections = req.body.slice() // slice to ensure native array

  for (let i = 0; i < orgs.length; i++) {
    const org = orgs[i]

    for (let j = 0; j < reposByOrg[org].length; j++) {
      const repo = reposByOrg[org][j]

      if (!selections.includes(repo.id)) {
        continue
      }

      repos.push(repo)
    }
  }

  if (!repos.length) {
    throw new ContentError('No repos selected')
  }

  // batching 3 promises at a time
  const apiWatchRepo = require('../repo/watch/post.js').call
  const batchAll = require('@conjurelabs/utils/Promise/batch-all')
  await batchAll(3, repos, repo => {
    return apiWatchRepo(req, {
      service: repo.service.toLowerCase(), // keep lower?
      url: repo.url,
      name: repo.name,
      fullName: repo.fullName,
      orgName: repo.org,
      orgId: repo.orgId,
      repoName: repo.name,
      githubId: repo.serviceRepoId,
      isPrivate: repo.private,
      vm: 'web' // forced to web for now
    })
  })

  // mark account as onboarded
  const { DatabaseTable } = require('@conjurelabs/db')
  const account = new DatabaseTable('account')
  await account.update({
    onboarded: true,
    updated: new Date()
  }, {
    id: req.user.id
  })

  // all good
  res.send({})

  slackNotify(repos)
})

function slackNotify(repos) {
  const request = require('request')
  request({
    url: 'https://hooks.slack.com/services/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',
    method: 'POST',
    json: true,
    body: {
      channel: '#conjure-repos',
      username: 'Conjure API',
      text: `Repo{repos.length === 1 ? '' : 's'} watched`,
      icon_emoji: ':conjure:',
      attachments: [{
        fields: repos.map(repo => {
          return {
            title: `${repo.org}/${repo.name}`,
            value: `<${repo.url}|${repo.service}>`,
            short: false
          }
        })
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

module.exports = route
