const { NotFoundError } = require('@conjurelabs/err')
const config = require('conjure-core/modules/config')
const Route = require('@conjurelabs/route')

const route = new Route()

// first checking to make sure the installation is valid
route.push(async (req, res, next) => {
  const installationId = req.query.installation_id

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

  /*
    This is a little confusing but,

    A) user logs into Conjure, auths, and then installs,
       then the user will hit this page (logged in) and
       we will be able to pull all associated repos for
       the logged-in user

    OR

    B) user installs app via GitHub, which means not
       signed into Conjure yet, and hits this page.
       we will not be able to save associated repos yet,
       but when the new user is kicked to the force /login
       page, she will then go through the oauth flow,
       which will then skip _this_ endpoint, but will
       not fail at the saveVisibleAccountRepos call
       in the oauth handler, since app is installed
   */
  if (req.isAuthenticated()) {
    const apiGetAccountGitHub = require('../github/get.js').call
    const gitHubAccount = (await apiGetAccountGitHub(req)).account

    const saveVisibleAccountRepos = require('../../../../save-visible-repos')
    await saveVisibleAccountRepos(req.user, gitHubAccount)
  }

  // on success the api redirects back to web
  res.redirect(302, `${config.app.web.url}/login`)
})

module.exports = route
