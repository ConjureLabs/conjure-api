const { NotFoundError } = require('@conjurelabs/err')
const Route = require('@conjurelabs/route')

const route = new Route()

// first checking to make sure the installation is valid
route.push(async (req, res, next) => {
  const installationId = req.query.installation_id

  console.log('HEADERS')
  console.log(req.headers)

  const GitHubAPI = require('conjure-core/classes/GitHub/API/App')
  const api = new GitHubAPI()

  // see https://developer.github.com/v3/apps/#get-a-single-installation
  /*
  { id: 181892,
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
    repository_selection: 'selected',
    access_tokens_url: 'https://api.github.com/installations/181892/access_tokens',
    repositories_url: 'https://api.github.com/installation/repositories',
    html_url: 'https://github.com/organizations/ConjureLabs/settings/installations/181892',
    app_id: 12174,
    target_id: 1783213,
    target_type: 'Organization',
    permissions: 
     { pull_requests: 'write',
       contents: 'read',
       single_file: 'read',
       metadata: 'read' },
    events: [ 'pull_request' ],
    created_at: '2018-05-19T02:06:20.000Z',
    updated_at: '2018-05-19T02:06:20.000Z',
    single_file_name: '/.conjure/config.yml' }
   */
  const installation = await api.request({
    path: `/app/installations/${installationId}`
  })

  if (!installation) {
    return next(new NotFoundError(`Installation ${installationId} does not exist`))
  }

  const { DatabaseTable } = require('@conjurelabs/db')
  const now = new Date()
  await DatabaseTable.upsert('githubAppInstallation', {
    // insert
    githubId: installation.account.id,
    username: installation.account.login,
    githubAccountType: installation.target_type,
    installationId: installation.id,
    photo: installation.account.avatar_url,
    lastVerifiedActive: now,
    added: now
  }, {
    // update
    username: installation.account.login,
    githubAccountType: installation.target_type,
    photo: installation.account.avatar_url,
    lastVerifiedActive: now,
    updated: now
  }, {
    // update where
    installationId: installation.id
  })

  // on success the api redirects back to web
  res.redirect(302, config.app.web.url)
})

module.exports = route
