'use strict';

var utils = require('../utils.js');
var log = require('npmlog');

module.exports = function (http, api, ctx) {
  return function httpPostFormData(url, form, qs, callback, notAPI) {
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
    if (typeof qs == 'function') {
      callback = qs;
      qs = {}
    }
    if (typeof qs == 'boolean') {
      notAPI = qs;
      qs = {}
    }
    if (typeof callback == 'boolean') {
      notAPI = callback;
      callback = null;
    }
    if (typeof callback == 'function') 
      cb = callback;

    let mainPromise;
    if (notAPI) 
      mainPromise = utils.postFormData(url, ctx.jar, form, qs, ctx.globalOptions, ctx);
    else 
      mainPromise = http.postFormData(url, ctx.jar, form, qs);

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
