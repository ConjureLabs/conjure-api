const { UnexpectedError, ContentError } = require('@conjurelabs/err')
const Route = require('@conjurelabs/route')
const config = require('conjure-core/modules/config')

const route = new Route({
  requireAuthentication: true
})

route.push(async (req, res) => {
  const onboardReposSelectionCookie = req.cookieSecure('onboard-repos')
  const onboardReposSelection = JSON.parse(onboardReposSelectionCookie)

  if (!onboardReposSelection) {
    throw new UnexpectedError('Expected onboard repos selection (cookie)')
  }

  const cardResult = await saveCreditCard(req)
  const { reposByOrg, selectedOrgs } = await saveReposSelected(req, onboardReposSelection)
  await enableBillingPlan(req, reposByOrg, selectedOrgs)

  // mark account as onboarded
  const { DatabaseTable } = require('@conjurelabs/db')
  const account = new DatabaseTable('account')
  await account.update({
    onboarded: true,
    updated: new Date()
  }, {
    id: req.user.id
  })

  emailUser(req)

  res.clearCookie('onboard-repos')

  res.cookie('conjure-added-payment', '' + Date.now())

  res.send(cardResult)
})

async function saveCreditCard(req) {
  const apiAccountCardCreation = require('../../account/payment/card/post.js').call
  const result = await apiAccountCardCreation(req, req.body)
  return result
}

async function saveReposSelected(req, onboardReposSelection) {
  // getting all user repos
  const apiGetRepos = require('../../repos/get.js').call
  const apiGetReposResult = apiGetRepos(req)
  const { reposByOrg } = await apiGetReposResult

  // filtering down to repos selected
  const repos = []
  const selectedOrgs = []
  const orgNames = Object.keys(reposByOrg)

  for (let i = 0; i < orgNames.length; i++) {
    const orgName = orgNames[i]

    for (let j = 0; j < reposByOrg[orgName].length; j++) {
      const repo = reposByOrg[orgName][j]

      if (!onboardReposSelection.includes(repo.id)) {
        continue
      }

      if (!selectedOrgs.includes(orgName)) {
        selectedOrgs.push(orgName)
      }

      repos.push(repo)
    }
  }

  if (!repos.length) {
    throw new ContentError('No repos selected')
  }

  const batchAll = require('@conjurelabs/utils/Promise/batch-all')
  const apiWatchRepo = require('../../repo/watch/post.js').call
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

  return {
    selectedRepos: repos,
    reposByOrg,
    selectedOrgs: selectedOrgs
  }
}

async function enableBillingPlan(req, reposByOrg, selectedOrgs) {
  const { DatabaseTable } = require('@conjurelabs/db')
  const orgPlan = new DatabaseTable('githubOrgBillingPlan')
  const batchAll = require('@conjurelabs/utils/Promise/batch-all')

  // activate billing plan for each org
  await batchAll(3, selectedOrgs, orgName => {
    // getting the org id from the first repo row for the org
    // these will activated once payment is entered
    const orgId = reposByOrg[orgName][0].orgId
    return orgPlan.insert({
      account: req.user.id,
      org: orgName,
      orgId,
      billingPlan: 2, // current main plan
      added: new Date()
    })
  })
}

async function emailUser(req) {
  const apiAccountGet = require('../../account/get.js').call
  const account = (await apiAccountGet(req)).account
  const mail = require('conjure-core/modules/mail')
  mail.send({
    to: account.email,
    subject: 'Welcome to Conjure!',
    html: `
      <body>
        <div style="display: block; padding: 20px; text-align: center;">
          <h2 style="display: block; font-size: 32px; font-weight: 600; margin-bottom: 42px; color: #434245;">You've joined Conjure 👏</h2>
          <p style="display: block; font-size: 16px; font-weight: 100; margin-bottom: 32px; color: #434245;">At any time you can manage what Conjure watches at <a href='${config.app.web.url}'>${config.app.web.host}</a>.</p>
          <p style="display: block; font-size: 14px; font-weight: 100; margin-bottom: 24px; color: #434245;">Don't forget to read <a href='${config.app.web.url}/docs/configuration'>our configuration docs</a> to make sure your repos are set up properly.</p>
          <p style="display: block; font-size: 14px; font-weight: 100; margin-bottom: 10px; color: #434245;">We're happy you've joined us!</p>
        </div>
      </body>
    `
  })
}

module.exports = route
