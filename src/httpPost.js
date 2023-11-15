'use strict';

var utils = require('../utils.js');
var log = require('npmlog');

module.exports = function (http, api, ctx) {
  return function httpPost(url, form, customHeader, callback, notAPI) {
    var cb;
    var returnPromise = new Promise(function (resolve, reject) {
      cb = (error, body) => body ? resolve(body) : reject(error);
    });

    if (typeof form == 'function') {
      callback = form;
      form = {}
    }
    if (typeof form == 'boolean') {
      notAPI = form;
      form = {}
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
      mainPromise = utils.post(url, ctx.jar, form, ctx.globalOptions, ctx, customHeader);
    else 
      mainPromise = http.post(url, ctx.jar, form, null, null, customHeader);

    mainPromise
      .then(function (res) {
        var body = res.body.toString();
        return cb(null, body);
      })
      .catch(function (err) {
        log.error('httpPost', err);
        return cb(err);
      });

    return returnPromise;
  }
}
