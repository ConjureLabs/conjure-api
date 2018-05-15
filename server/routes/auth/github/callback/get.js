const { UnexpectedError } = require('@conjurelabs/err')
const config = require('conjure-core/modules/config')
const Route = require('@conjurelabs/route')
const passport = require('passport')

const route = new Route()

/*
  Auth callback
 */
route.push(passport.authenticate('github', {
  failureRedirect: config.app.web.url
}))

// figuring out if user is already set up within Conjure
route.push(async (req, res, next) => {
  const { DatabaseTable } = require('@conjurelabs/db')

  const githubAccountRecords = await DatabaseTable.select('accountGithub', {
    account: req.user.id
  })

  // should not happen
  if (!githubAccountRecords.length) {
    throw new UnexpectedError(`No associated GitHub account record for account ${req.user.id}`)
  }

  const githubAccount = githubAccountRecords[0]

  const GitHubAPI = require('conjure-core/classes/GitHub/API/App')
  const api = new GitHubAPI()

  // see https://developer.github.com/v3/apps/#list-installations-for-user
  /*
    sample output:
    [ { id: 176296,
    account: 
     { login: 'ConjureLabs',
       id: 1783213,
       avatar_url: 'https://avatars1.githubusercontent.com/u/1783213?v=4',
       gravatar_id: '',
       url: 'https://api.github.com/users/ConjureLabs',
       html_url: 'https://github.com/ConjureLabs',
       followers_url: 'https://api.github.com/users/ConjureLabs/followers',
       following_url: 'https://api.github.com/users/ConjureLabs/following{/other_user}',
       gists_url: 'https://api.github.com/users/ConjureLabs/gists{/gist_id}',
       starred_url: 'https://api.github.com/users/ConjureLabs/starred{/owner}{/repo}',
       subscriptions_url: 'https://api.github.com/users/ConjureLabs/subscriptions',
       organizations_url: 'https://api.github.com/users/ConjureLabs/orgs',
       repos_url: 'https://api.github.com/users/ConjureLabs/repos',
       events_url: 'https://api.github.com/users/ConjureLabs/events{/privacy}',
       received_events_url: 'https://api.github.com/users/ConjureLabs/received_events',
       type: 'Organization',
       site_admin: false },
    repository_selection: 'all',
    access_tokens_url: 'https://api.github.com/installations/176296/access_tokens',
    repositories_url: 'https://api.github.com/installation/repositories',
    html_url: 'https://github.com/organizations/ConjureLabs/settings/installations/176296',
    app_id: 12174,
    target_id: 1783213,
    target_type: 'Organization',
    permissions: 
     { pull_requests: 'write',
       contents: 'read',
       single_file: 'read',
       metadata: 'read' },
    events: [ 'pull_request' ],
    created_at: '2018-05-15T01:28:47.000Z',
    updated_at: '2018-05-15T01:28:48.000Z',
    single_file_name: '/.conjure/config.yml' } ]
   */
  const installations = await api.request({
    path: '/app/installations',
    qs: {
      access_token: githubAccount.accessToken
    }
  })

  if (installations.total_count === 0) {
    return res.redirect(302, `https://github.com/apps/${config.services.github.app.name}/installations/new`)
  }

  next()
})

route.push((req, res) => {
  if (req.cookies && typeof req.cookies['conjure-auth-redirection'] === 'string') {
    res.clearCookie('conjure-auth-redirection')
    res.redirect(302, req.cookies['conjure-auth-redirection'])
    return
  }

  // seeing if user has any repos w/ app installed (on github)
  

  res.redirect(302, config.app.web.url)
})

module.exports = route
