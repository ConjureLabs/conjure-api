const Route = require('@conjurelabs/route')
const { ConjureError, ContentError, PermissionsError } = require('@conjurelabs/err')
const log = require('conjure-core/modules/log')('github watch repo')

const route = new Route({
  requireAuthentication: true
})

route.push(async (req, res) => {
  const { DatabaseTable } = require('@conjurelabs/db')
  const { org, name } = req.body

  if (!org || !name) {
    throw new ContentError('Request body missing required fields')
  }

  // ensure user has correct access to this repo
  const apiRepos = require('../../repos/get.js').call
  const { reposByOrg } = await apiRepos(req, {
    org,
    name
  })

  if (!reposByOrg[org] || !reposByOrg[org].length) {
    throw new PermissionsError('User does not have access to this repo')
  }

  const watchedRecords = await DatabaseTable.update('watchedRepo', {
    disabled: true,
    updated: new Date()
  }, {
    org,
    name
  })

  res.send({
    success: true
  })

  try {
    slackNotify(watchedRecords[0])
  } catch(err) {}
})

function slackNotify(watchedRecord) {
  if (process.env.NODE_ENV !== 'production') {
    return
  }

  const request = require('request')
  request({
    url: 'https://hooks.slack.com/services/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',
    method: 'POST',
    json: true,
    body: {
      channel: '#conjure-repos',
      username: 'Sad News',
      text: 'Repo revoked',
      icon_emoji: ':x:',
      attachments: [{
        fields: [{
          title: `${watchedRecord.org}/${watchedRecord.name}`,
          value: `<https://github.com/${watchedRecord.org}/${watchedRecord.name}|${watchedRecord.service}>`,
          short: false
        }]
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
