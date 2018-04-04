const Route = require('@conjurelabs/route')
const { ConjureError } = require('@conjurelabs/err')
const log = require('conjure-core/modules/log')('github webhook inbound')
const Queue = require('conjure-core/classes/Queue')

const route = new Route()

route.push(async (req, res, next) => {
  const GitHubWebhookPayload = require('conjure-core/classes/Repo/GitHub/Webhook/Payload')
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
  const DatabaseTable = require('@conjurelabs/db/table')
  // checking if a running instance exists
  const activeContainers = DatabaseTable.select('container', {
    repo: repoId,
    branch: branch,
    isActive: true
  })

  if (activeContainers.length) {
    return handleActiveContainer(req, action)
  }
  handleInactiveContainer(req, action)
})

function handleActiveContainer(req, action) {
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
    case GitHubWebhookPayload.actions.merged:
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

function handleInactiveContainer(req, action) {
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
