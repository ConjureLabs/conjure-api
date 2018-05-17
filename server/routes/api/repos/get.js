const Route = require('@conjurelabs/route')

const route = new Route({
  requireAuthentication: true
})

/*
  Repos listing
 */
route.push(async (req, res) => {
  const UniqueArray = require('conjure-core/classes/Array/UniqueArray')
  const GitHubRepo = require('conjure-core/classes/Repo/GitHub')

  // todo: assumes account has a github record in our db - we should have more handlers for services like bitbucket
  const apiGetAccountGitHub = require('../account/github/get.js').call
  const githubAccount = (await apiGetAccountGitHub(req)).account

  const GitHubUserAPI = require('conjure-core/classes/GitHub/API/User')
  const gitHubClient = new GitHubUserAPI(gitHubAccount.accessToken)

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

  const allRepos = new UniqueArray('fullName')
  
  const gitHubOrgs = await promisifyGitHubOrgs(githubClient)

  // getting all (possibly private) org repos
  const batchAll = require('@conjurelabs/utils/Promise/batch-all')
  const allOrgsRepos = await batchAll(4, gitHubOrgs, org => {
    return promisifyGitHubOrgRepos(githubClient, org)
  })

  for (let i = 0; i < allOrgsRepos.length; i++) {
    // each collection in the batch is for an org
    const orgRepos = allOrgsRepos[i]

    for (let j = 0; j < orgRepos.length; j++) {
      // each repo within... push into full repo array
      allRepos.push(new GitHubRepo(orgRepos[j]))
    }
  }

  // user repos
  const userRepos = await promisifyGitHubUserRepos(githubClient, githubAccount)

  for (let i = 0; i < userRepos.length; i++) {
    const repo = new GitHubRepo(userRepos[i])

    // filter out repos where the user does not have the correct permissions
    // todo: possibly make it apparent via the UI that repos were not shown?
    if (repo.permissions.admin !== true) {
      continue
    }

    allRepos.push(repo)
  }

  // todo: pagination - should pull org names, then drill in via UI with api calls, which pages (in UI too)
  const finalRepos = allRepos.native

  const sortInsensitive = require('@conjurelabs/utils/Array/sort-insensitive')
  sortInsensitive(finalRepos, 'fullName')

  const reposByOrg = finalRepos.reduce((mapping, current) => {
    const orgRepos = mapping[ current.org ]

    if (!Array.isArray(orgRepos)) {
      mapping[ current.org ] = [ current ]
    } else {
      orgRepos.push(current)
    }

    return mapping
  }, {})

  // todo: stop sending by org all the time - it's an overhead most of the time
  res.send({
    reposByOrg
  })
})

// todo: something better
function promisifyGitHubOrgs(client) {
  return new Promise((resolve, reject) => {
    client.get('/user/orgs', {}, (err, status, body) => {
      if (err) {
        return reject(err)
      }
      resolve(body)
    })
  })
}

function promisifyGitHubOrgRepos(client, org) {
  return new Promise((resolve, reject) => {
    client
      .org(org.login)
      .repos((err, repos) => {
        if (err) {
          return reject(err)
        }
        resolve(repos)
      })
  })
}

function promisifyGitHubUserRepos(client, githubAccount) {
  return new Promise((resolve, reject) => {
    client
      .user(githubAccount.username)
      .repos((err, repos) => {
        if (err) {
          return reject(err)
        }
        resolve(repos)
      })
  })
}

module.exports = route
