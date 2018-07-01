const Route = require('@conjurelabs/route')
const { ConjureError } = require('@conjurelabs/err')
const log = require('conjure-core/modules/log')('github webhook inbound')
const Queue = require('conjure-core/classes/Queue')
const GitHubWebhookPayload = require('conjure-core/classes/Repo/GitHub/Webhook/Payload')

const route = new Route()

route.push(async (req, res, next) => {
  // console.log('HEADERS')
  // console.log(req.headers)

  // console.log('PAYLOAD')
  // console.log(req.body)
  
  if (req.body.action === 'created' && req.body.installation) {
    await handleInstallation(req.body)
    return res.send({
      success: true,
      type: 'installation',
      action: 'created'
    })
  }

  // todo: try catch this? payload may be different than we exepect
  const payload = new GitHubWebhookPayload(req.body)
  const { type, action, repoId, branch } = payload

  // telling GitHub it's all good, right away
  res.send({
    success: true,
    type,
    action
  })

  if (type === GitHubWebhookPayload.types.branch) {
    // todo: if the commit is ontop of a PR, we will have to update the container
    return next()
  }

  // todo: queue this? what happens if hooks happen too frequently?
  const { query } = require('@conjurelabs/db')
  // checking if a running instance exists
  const activeContainersResult = await query(`
    SELECT c.id
    FROM container c
    INNER JOIN watched_repo wr
    ON c.repo = wr.id
    WHERE wr.service_repo_id = $1
    AND branch = $2
    AND is_active IS TRUE
    AND wr.disabled IS FALSE
  `, [repoId, branch])

  if (activeContainersResult.rows.length) {
    return handleActiveContainer(req, action)
  }
  handleInactiveContainer(req, action)
})

/*
  {
  "action": "created",
  "installation": {
    "id": 194499,
    "account": {
      "login": "ConjureLabs",
      "id": 1783213,
      "avatar_url": "https://avatars1.githubusercontent.com/u/1783213?v=4",
      "gravatar_id": "",
      "url": "https://api.github.com/users/ConjureLabs",
      "html_url": "https://github.com/ConjureLabs",
      "followers_url": "https://api.github.com/users/ConjureLabs/followers",
      "following_url": "https://api.github.com/users/ConjureLabs/following{/other_user}",
      "gists_url": "https://api.github.com/users/ConjureLabs/gists{/gist_id}",
      "starred_url": "https://api.github.com/users/ConjureLabs/starred{/owner}{/repo}",
      "subscriptions_url": "https://api.github.com/users/ConjureLabs/subscriptions",
      "organizations_url": "https://api.github.com/users/ConjureLabs/orgs",
      "repos_url": "https://api.github.com/users/ConjureLabs/repos",
      "events_url": "https://api.github.com/users/ConjureLabs/events{/privacy}",
      "received_events_url": "https://api.github.com/users/ConjureLabs/received_events",
      "type": "Organization",
      "site_admin": false
    },
    "repository_selection": "all",
    "access_tokens_url": "https://api.github.com/installations/194499/access_tokens",
    "repositories_url": "https://api.github.com/installation/repositories",
    "html_url": "https://github.com/organizations/ConjureLabs/settings/installations/194499",
    "app_id": 12491,
    "target_id": 1783213,
    "target_type": "Organization",
    "permissions": {
      "pull_requests": "write",
      "issues": "write",
      "contents": "read",
      "single_file": "read",
      "metadata": "read"
    },
    "events": [
      "pull_request"
    ],
    "created_at": 1527542860,
    "updated_at": 1527542860,
    "single_file_name": "/.conjure/config.yml"
  },
  "repositories": [
    {
      "id": 76816056,
      "name": "sentry",
      "full_name": "ConjureLabs/sentry",
      "private": true
    },
    {
      "id": 83164113,
      "name": "conjure-web",
      "full_name": "ConjureLabs/conjure-web",
      "private": true
    },
    {
      "id": 83168065,
      "name": "mock-web-repo",
      "full_name": "ConjureLabs/mock-web-repo",
      "private": true
    },
    {
      "id": 89115676,
      "name": "mock-web-repo-two",
      "full_name": "ConjureLabs/mock-web-repo-two",
      "private": true
    },
    {
      "id": 89659868,
      "name": "conjure-core",
      "full_name": "ConjureLabs/conjure-core",
      "private": true
    },
    {
      "id": 92512480,
      "name": "conjure-api",
      "full_name": "ConjureLabs/conjure-api",
      "private": true
    },
    {
      "id": 102423520,
      "name": "conjure-worker",
      "full_name": "ConjureLabs/conjure-worker",
      "private": true
    },
    {
      "id": 102976100,
      "name": "federal",
      "full_name": "ConjureLabs/federal",
      "private": false
    },
    {
      "id": 119111842,
      "name": "peak-property-phuket",
      "full_name": "ConjureLabs/peak-property-phuket",
      "private": true
    },
    {
      "id": 119600503,
      "name": "freshwork",
      "full_name": "ConjureLabs/freshwork",
      "private": true
    },
    {
      "id": 119757136,
      "name": "utils",
      "full_name": "ConjureLabs/utils",
      "private": false
    },
    {
      "id": 119762069,
      "name": "err",
      "full_name": "ConjureLabs/err",
      "private": false
    },
    {
      "id": 119771304,
      "name": "db",
      "full_name": "ConjureLabs/db",
      "private": false
    },
    {
      "id": 119895556,
      "name": "route",
      "full_name": "ConjureLabs/route",
      "private": false
    },
    {
      "id": 122107766,
      "name": "node_redis",
      "full_name": "ConjureLabs/node_redis",
      "private": false
    },
    {
      "id": 130532721,
      "name": "hob",
      "full_name": "ConjureLabs/hob",
      "private": false
    },
    {
      "id": 133286750,
      "name": "passport-github",
      "full_name": "ConjureLabs/passport-github",
      "private": false
    },
    {
      "id": 135004753,
      "name": "conjure-language-support",
      "full_name": "ConjureLabs/conjure-language-support",
      "private": false
    }
  ],
  "sender": {
    "login": "tmarshall",
    "id": 52420,
    "avatar_url": "https://avatars0.githubusercontent.com/u/52420?v=4",
    "gravatar_id": "",
    "url": "https://api.github.com/users/tmarshall",
    "html_url": "https://github.com/tmarshall",
    "followers_url": "https://api.github.com/users/tmarshall/followers",
    "following_url": "https://api.github.com/users/tmarshall/following{/other_user}",
    "gists_url": "https://api.github.com/users/tmarshall/gists{/gist_id}",
    "starred_url": "https://api.github.com/users/tmarshall/starred{/owner}{/repo}",
    "subscriptions_url": "https://api.github.com/users/tmarshall/subscriptions",
    "organizations_url": "https://api.github.com/users/tmarshall/orgs",
    "repos_url": "https://api.github.com/users/tmarshall/repos",
    "events_url": "https://api.github.com/users/tmarshall/events{/privacy}",
    "received_events_url": "https://api.github.com/users/tmarshall/received_events",
    "type": "User",
    "site_admin": false
  }
}

 */
async function handleInstallation(/* payload */) {
  // todo: handle installation at hook instead of later
}

async function handleActiveContainer(req, action) {
  let queue

  switch (action) {
    // spin up vm
    case GitHubWebhookPayload.actions.opened:
      log.info('Received hook for "create"')
      queue = new Queue('container.create')
      try {
        await queue.push({
          content: req.body
        })
        log.info('Job pushed to queue (container.create)')
      } catch(err) {
        if (err) {
          log.error(err)
        }
      }
      break

    // restart vm
    case GitHubWebhookPayload.actions.reopened:
      log.info('Received hook for "start"')
      queue = new Queue('container.start')
      try {
        await queue.push({
          content: req.body
        })
        log.info('Job pushed to queue (container.start)')
      } catch(err) {
        if (err) {
          log.error(err)
        }
      }
      break

    // spin down vm
    case GitHubWebhookPayload.actions.closed:
      log.info('Received hook for "stop"')
      queue = new Queue('container.stop')
      try {
        await queue.push({
          content: req.body
        })
        log.info('Job pushed to queue (container.stop)')
      } catch(err) {
        if (err) {
          log.error(err)
        }
      }
      break

    // prune the issue
    case GitHubWebhookPayload.actions.merged:
      log.info('Received hook for "prune"')
      queue = new Queue('container.prune')
      try {
        await queue.push({
          content: req.body
        })
        log.info('Job pushed to queue (container.prune)')
      } catch(err) {
        if (err) {
          log.error(err)
        }
      }
      break

    // update running vm
    case GitHubWebhookPayload.actions.updated:
      log.info('Received hook for "update"')
      queue = new Queue('container.update')
      try {
        await queue.push({
          content: req.body
        })
        log.info('Job pushed to queue (container.update)')
      } catch(err) {
        log.error(err)
      }
      break
  }
}

async function handleInactiveContainer(req, action) {
  let queue

  switch (action) {
    // spin up vm
    case GitHubWebhookPayload.actions.opened:
    case GitHubWebhookPayload.actions.reopened:
      log.info('Received hook for "available"')
      queue = new Queue('container.available')
      try {
        await queue.push({
          content: req.body
        })
        log.info('Job pushed to queue (container.available)')
      } catch(err) {
        if (err) {
          log.error(err)
        }
      }
      break

    // spin down vm
    case GitHubWebhookPayload.actions.closed:
    case GitHubWebhookPayload.actions.merged:
      log.info('Received hook for "unavailable"')
      queue = new Queue('container.unavailable')
      try {
        await queue.push({
          content: req.body
        })
        log.info('Job pushed to queue (container.unavailable)')
      } catch(err) {
        if (err) {
          log.error(err)
        }
      }
      break
  }
}

module.exports = route
