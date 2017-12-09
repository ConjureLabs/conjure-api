const Route = require('conjure-core/classes/Route');

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
  const account = await apiAccountGet(req);
  const mail = require('conjure-core/modules/mail');
  mail.send({
    to: account.email,
    subject: 'Welcome to Conjure!',
    html: `
      <body>
        <div style="display: block; padding: 20px; text-align: center;">
          <h2 style="display: block; font-size: 16px; font-weight: 600; margin-bottom: 16px;">You've joined Conjure 👏</h2>
          <p style="display: block; font-size: 14px; font-weight: 100; margin-bottom: 12px;">At any time you can manage what Conjure watches at <a href='https://conjure.sh'>conjure.sh</a>.</p>
          <p style="display: block; font-size: 12px; font-weight: 100; margin-bottom: 12px;">Don't forget to read <a href='https://conjure.sh/docs/configuration'>our configuration documentation</a> to make sure your repos are set up properly.</p>
          <p style="display: block; font-size: 12px; font-weight: 100; margin-bottom: 12px;">We're happy you're you've joined us!</p>
        </div>
      </body>
    `
  });
}

module.exports = route;
