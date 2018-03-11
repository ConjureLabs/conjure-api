const Route = require('@conjurelabs/route');
const config = require('conjure-core/modules/config');

const route = new Route({
  requireAuthentication: true
});

route.push(async (req, res) => {
  const apiAccountCardCreation = require('../../account/billing/card/post.js').call;
  const result = await apiAccountCardCreation(req, req.body);

  emailUser(req);

  return res.send(result);
});

async function emailUser(req) {
  const apiAccountGet = require('../../account/get.js').call;
  const account = (await apiAccountGet(req)).account;
  const mail = require('conjure-core/modules/mail');
  mail.send({
    to: account.email,
    subject: 'Welcome to Conjure!',
    html: `
      <body>
        <div style="display: block; padding: 20px; text-align: center;">
          <h2 style="display: block; font-size: 32px; font-weight: 600; margin-bottom: 42px; color: #434245;">You've joined Conjure 👏</h2>
          <p style="display: block; font-size: 16px; font-weight: 100; margin-bottom: 32px; color: #434245;">At any time you can manage what Conjure watches at <a href='${config.app.web.url}'>${config.app.web.host}</a>.</p>
          <p style="display: block; font-size: 14px; font-weight: 100; margin-bottom: 24px; color: #434245;">Don't forget to read <a href='${config.app.web.url}/docs/configuration'>our configuration docs</a> to make sure your repos are set up properly.</p>
          <p style="display: block; font-size: 14px; font-weight: 100; margin-bottom: 10px; color: #434245;">We're happy you're you've joined us!</p>
        </div>
      </body>
    `
  });
}

module.exports = route;
