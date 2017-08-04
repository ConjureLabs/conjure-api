const async = require('async');
const Route = require('conjure-core/classes/Route');
const log = require('conjure-core/modules/log')('github webhook inbound');

// todo: move port logic into a class, and use available ports that are free'd
let workerPort = process.env.PORT;

// todo: set up a module that handles cases like this
const asyncBreak = {};

const route = new Route();

route.push((req, res, next) => {
  const { orgName, repoName } = req.params;
  const GitHubWebhookPayload = require('conjure-core/classes/Repo/GitHub/Webhook/Payload');

  const payload = new GitHubWebhookPayload(req.body);
  const { type, action } = payload;

  res.send({
    success: true,
    type,
    action
  });

  if (type === GitHubWebhookPayload.types.branch) {
    // todo: if the commit is ontop of a PR, we will have to update the vm
    return res.send({});
  }

  const Container = require('conjure-core/classes/Container/GitHub');
  const container = new Container(payload);

  // todo: what to do if a container is still starting and the pr is closed?

  switch (action) {
    // spin up vm
    case GitHubWebhookPayload.actions.opened:
    case GitHubWebhookPayload.actions.reopened:
      container.create(err => {
        if (err) {
          log.error(err);
        }
      });
      break;

    // spin down vm
    case GitHubWebhookPayload.actions.closed:
    case GitHubWebhookPayload.actions.merged:
      container.destroy(err => {
        if (err) {
          log.error(err);
        }
      });
      break;

    // update running vm
    case GitHubWebhookPayload.actions.updated:
      container.update(err => {
        if (err) {
          log.error(err);
        }
      });
      break;
  }
});

module.exports = route;
