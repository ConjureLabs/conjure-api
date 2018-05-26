const { UnexpectedError } = require('@conjurelabs/err')
const config = require('conjure-core/modules/config')
const Route = require('@conjurelabs/route')
const passport = require('passport')

const route = new Route()

/*
  Auth callback
 */
route.push(passport.authenticate('github', {
  failureRedirect: config.app.web.url
}))

// figuring out if user is already set up within Conjure
route.push(async (req, res, next) => {
  if (req.user.requiresInstallation === true) {
    return res.redirect(302, `https://github.com/apps/${config.services.github.app.name}/installations/new`)
  }
  next()
})

route.push((req, res) => {
  if (req.cookies && typeof req.cookies['conjure-auth-redirection'] === 'string') {
    res.clearCookie('conjure-auth-redirection')
    res.redirect(302, req.cookies['conjure-auth-redirection'])
    return
  }

  res.redirect(302, config.app.web.url)
})

module.exports = route
