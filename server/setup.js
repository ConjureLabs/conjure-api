'use strict';

// allowing sync methods in this file only
// ... allowing sync in this file since it will only be run at startup, not during the lifetime of the app
/*eslint no-sync: 0*/

const fs = require('fs');
const path = require('path');
const log = require('voyant-core/modules/log')();

log.info('beginning setup');
log.timeStart('finished setup');

// crawling routes
// const apiRoutesDir = path.resolve(__dirname, 'routes', 'api');
// const hookRoutesDir = path.resolve(__dirname, 'routes', 'hook');
// const viewsRoutesDir = path.resolve(__dirname, 'routes', 'views');
// const containerRoutesDir = path.resolve(__dirname, 'routes', 'c');
const jsFileExt = /\.js$/;
const startingDollarSign = /^\$/;
const validVerbs = ['all', 'get', 'post', 'put', 'patch', 'delete'];

// todo: remove ignoreCurrentDir logic, find a cleaner solution
function crawlRoutesDir(ignoreCurrentDir, dirpath, uriPathTokens) {
  if (arguments.length === 2) {
    // at first call, only a directory path is given
    uriPathTokens = [];
  }

  // adding to the tokens of the express route, based on the current directory being crawled
  // a folder starting with a $ will be considered a req param
  // (The : used in express does not work well in directory naming)
  if (ignoreCurrentDir !== true) {
    const base = path.parse(dirpath).base;
    uriPathTokens.push(base.replace(startingDollarSign, ':'));
  }

  const list = fs.readdirSync(dirpath);
  const routes = [];
  const files = [];

  list.sort((a, b) => {
    // see http://stackoverflow.com/questions/8996963/how-to-perform-case-insensitive-sorting-in-javascript
    return a.toLowerCase().localeCompare(b.toLowerCase());
  });

  for (let i = 0; i < list.length; i++) {
    const stat = fs.statSync(path.resolve(dirpath, list[i]));

    if (stat.isFile() && jsFileExt.test(list[i])) {
      files.push(list[i]);
      continue;
    }

    if (stat.isDirectory()) {
      const subdirRoutes = crawlRoutesDir(false, path.resolve(dirpath, list[i]), uriPathTokens.slice());

      for (let j = 0; j < subdirRoutes.length; j++) {
        routes.push(subdirRoutes[j]);
      }
    }
  }

  for (let i = 0; i < files.length; i++) {
    const verb = files[i].replace(jsFileExt, '').toLowerCase();

    if (!validVerbs.includes(verb)) {
      continue;
    }

    const individualRoute = require(path.resolve(dirpath, files[i]));
    routes.push(individualRoute.expressRouter(verb, '/' + uriPathTokens.join('/')));
  }
  
  return routes;
}

log.timeEnd('finished setup');

module.exports = {
  routes: {
    // api: crawlRoutesDir(false, apiRoutesDir),
    // hook: crawlRoutesDir(false, hookRoutesDir),
    // views: crawlRoutesDir(true, viewsRoutesDir),
    // c: crawlRoutesDir(false, containerRoutesDir)
  }
};
