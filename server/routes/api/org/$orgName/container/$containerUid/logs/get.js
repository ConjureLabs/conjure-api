const Route = require('conjure-core/classes/Route');
const ContentError = require('conjure-core/modules/err').ContentError;
const UnexpectedError = require('conjure-core/modules/err').UnexpectedError;
const config = require('conjure-core/modules/config');

const route = new Route({
  requireAuthentication: false
});

const webConfig = config.app.web;

/*
  Container logs, getting the setup needed to connect via sockets
 */
route.push((req, res, next) => {
  const orgName = req.params.orgName;
  const containerUid = req.params.containerUid;

  const database = require('conjure-core/modules/database');

  // todo: verify user has github access to this org

  // pulling 1 more than needed, to check if there are more results
  database.query('SELECT domain FROM container WHERE url_uid = $1', [containerUid], (err, result) => {
    if (err) {
      return next(err);
    }

    // should not happen
    if (!Array.isArray(result.rows)) {
      return next(new UnexpectedError('No rows returned'));
    }

    const container = result.rows[0];

    const request = require('request');

    const workerHost = container.domain.split('.').slice(1).join('.');
    request({
      method: 'POST',
      url: `${config.app.worker.protocol}://${workerHost}:${config.app.worker.port}/github/container/logs`,
      body: {
        orgName,
        containerUid
      },
      json: true
    }, (logsErr, logsRes, logsBody) => {
      if (logsErr) {
        return next(logsErr);
      }

      console.log(logsRes);

      res.send({
        sessionKey: logsBody.sessionKey,
        host: workerHost
      });
    });
  });
});

module.exports = route;
