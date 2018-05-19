// todo: re-save on a cron
module.exports = async function saveVisibleAccountRepos(account, githubAccount) {
  const { DatabaseTable } = require('@conjurelabs/db')

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

  if (installations.length === 0) {
    account.requiresInstallation = true
    return
  }

  // saving installations
  const installSummary = await saveInstallationRecords(installations)
  await installInstallRepos(api, installSummary, githubAccount)
}

async function saveInstallationRecords(installations) {
  const { DatabaseTable } = require('@conjurelabs/db')

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
  const batchAll = require('@conjurelabs/utils/Promise/batch-all')
  const installationRecords = await batchAll(4, installations, install => {
    const { id, account } = install
    const now = new Date()
    return DatabaseTable.upsert('githubAppInstallation', {
      githubId: account.id,
      username: account.login,
      githubAccountType: account.target_type,
      installationId: id,
      photo: account.avatar_url,
      lastVerifiedActive: now,
      added: now
    }, {
      username: account.login,
      githubAccountType: account.target_type,
      photo: account.avatar_url,
      lastVerifiedActive: now,
      updated: now
    }, {
      installationId: id
    })
  })

  const installedAppsSummary = installationRecords.map(install => ({
    username: install.username,
    installationId: install.installationId
  }))

  return installedAppsSummary
}

async function installInstallRepos(api, installSummary, githubAccount) {
  /*
    install --> [{ username:, installationId: }]
   */
  const { DatabaseTable, query } = require('@conjurelabs/db')
  const uuidv4 = require('uuid/v4') // using uuid to track fresh installs, so prune will be easy
  
  const verificationIdentifier = uuidv4()
  const accountRepo = new DatabaseTable('accountRepo')

  for (let install of installSummary) {
    // see https://developer.github.com/v3/apps/installations/#list-repositories
    let reposResult = await api.request({
      path: '/installation/repositories'
    })

    const allRepos = reposResult.repositories
    while (reposResult.next) {
      reposResult = await api.request({
        path: reposResult.next
      })
      if (!reposResult.repositories.length) {
        break
      }
      allRepos.push(...reposResult.repositories)
    }

    // run upserts
    const batchAll = require('@conjurelabs/utils/Promise/batch-all')
    await batchAll(3, allRepos, repo => {
      console.log(`UPSERTING ${repo.org} / ${repo.name}`)
      return accountRepo.upsert({
        // insert
        account: githubAccount.account,
        service: 'github',
        serviceRepoId: repo.id,
        url: repo.url,
        org: repo.org,
        name: repo.name,
        accessRights: repo.permissions && repo.permissions.push === true ? 'rw' : 'r',
        private: repo.private === true,
        verificationIdentifier,
        added: new Date()
      }, {
        // update
        url: repo.url,
        org: repo.org,
        name: repo.name,
        accessRights: repo.permissions && repo.permissions.push === true ? 'rw' : 'r',
        private: repo.private === true,
        verificationIdentifier,
        updated: new Date()
      }, {
        // update where
        account: githubAccount.account,
        service: 'github',
        serviceRepoId: repo.id
      })
    })

    // prune out the old ids, that are apparently no longer visible
    await query(`
      DELETE FROM account_repo
      WHERE account = $1
      AND service = 'github'
      AND verification_identifier != $2
    `, [githubAccount.account, verificationIdentifier])
  }
}
