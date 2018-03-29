const Route = require('@conjurelabs/route')

const route = new Route({
  requireAuthentication: true
})

/*
  Repos listing
 */
route.push(async (req, res) => {
  // todo: assumes account has a github record in our db - we should have more handlers for services like bitbucket
  const apiGetAccountGitHub = require('../github/get.js').call
  const gitHubAccount = (await apiGetAccountGitHub(req)).account

  const github = require('octonode')
  const gitHubClient = github.client(gitHubAccount.access_token)

  // just for debub purposes
  // todo: move or remove this
  gitHubClient.limit((err, left, max, reset) => {
    if (err) {
      console.log(err)
    } else {
      console.log('left', left)
      console.log('max', max)
      console.log('reset', reset)
    }
  })

  const repos = await promisifyGitHubUserRepos(gitHubClient, gitHubAccount)

  const sortInsensitive = require('@conjurelabs/utils/Array/sort-insensitive')
  sortInsensitive(repos, 'fullName')

  // todo: stop sending by org all the time - it's an overhead most of the time
  res.send({
    [gitHubAccount.username]: repos
  })
})

function promisifyGitHubUserRepos(client, gitHubAccount) {
  return new Promise((resolve, reject) => {
    client
      .user(gitHubAccount.username)
      .repos((err, repos) => {
        if (err) {
          return reject(err)
        }
        resolve(repos)
      })
  })
}

module.exports = route
