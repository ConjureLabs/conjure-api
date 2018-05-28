const Route = require('@conjurelabs/route')
const { ConjureError } = require('@conjurelabs/err')
const log = require('conjure-core/modules/log')('github watch repo')

const route = new Route({
  requireAuthentication: true
})

route.push(async (req, res) => {
  const { DatabaseTable } = require('@conjurelabs/db')

  const {
    service,
    url,
    orgName,
    orgId,
    name,
    githubId,
    isPrivate,
    vm
  } = req.body

  const watchedRecords = await DatabaseTable.upsert('watchedRepo', {
    account: req.user.id,
    service,
    serviceRepoId: githubId,
    url,
    org: orgName,
    orgId,
    name,
    vm,
    private: isPrivate,
    disabled: false,
    added: new Date()
  }, {
    disabled: false,
    updated: new Date()
  }, {
    service,
    serviceRepoId: githubId
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
      username: 'Conjure API',
      text: 'Repo watched',
      icon_emoji: ':conjure:',
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
