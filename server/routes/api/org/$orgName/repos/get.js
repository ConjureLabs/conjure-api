const Route = require('@conjurelabs/route')

const route = new Route({
  requireAuthentication: true
})

/*
  Repos listing
 */
route.push(async (req, res) => {
  const orgName = req.params.orgName

  // todo: assumes account has a github record in our db - we should have more handlers for services like bitbucket
  const apiGetAccountGitHub = require('../../../account/github/get.js').call
  const githubAccount = (await apiGetAccountGitHub(req)).account

  const github = require('octonode')
  const githubClient = github.client(githubAccount.access_token)

  // just for debub purposes
  // todo: move or remove this
  githubClient.limit((err, left, max, reset) => {
    if (err) {
      console.log(err)
    } else {
      console.log('left', left)
      console.log('max', max)
      console.log('reset', reset)
    }
  })

  const repos = await promisifyGitHubOrgRepos(githubClient, orgName)

  const sortInsensitive = require('@conjurelabs/utils/Array/sort-insensitive')
  sortInsensitive(repos, 'full_name')

  // todo: stop sending by org all the time - it's an overhead most of the time
  return res.send({
    [orgName]: repos
  })
})

function promisifyGitHubOrgRepos(client, orgName) {
  return new Promise((resolve, reject) => {
    client
      .org(orgName)
      .repos((err, repos) => {
        if (err) {
          return reject(err)
        }
        resolve(repos)
      })
  })
}

module.exports = route
