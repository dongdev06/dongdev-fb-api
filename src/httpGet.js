'use strict';

var utils = require('../utils.js');
var log = require('npmlog');

module.exports = function (http, api, ctx) {
  return function httpGet(url, qs, customHeader, callback, notAPI) {
    var cb;
    var returnPromise = new Promise(function (resolve, reject) {
      cb = (error, body) => body ? resolve(body) : reject(error);
    });

    if (typeof qs == 'function') {
      callback = qs;
      qs = {}
    }
    if (typeof qs == 'boolean') {
      notAPI = qs;
      qs = {}
    }
    if (typeof customHeader == 'function') {
      callback = customHeader;
      customHeader = {}
    }
    if (typeof customHeader == 'boolean') {
      notAPI = customHeader;
      customHeader = {}
    }
    if (typeof callback == 'boolean') {
      notAPI = callback;
      callback = null;
    }
    if (typeof callback == 'function') 
      cb = callback;

    let mainPromise;
    if (notAPI) 
      mainPromise = utils.get(url, ctx.jar, qs, ctx.globalOptions, ctx, customHeader);
    else 
      mainPromise = http.get(url, ctx.jar, qs, null, null, customHeader);

    mainPromise
      .then(function (res) {
        var body = res.body.toString();
        return cb(null, body);
      })
      .catch(function (err) {
        log.error('httpGet', err);
        return cb(err);
      });

    return returnPromise;
  }
}
