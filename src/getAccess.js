'use strict';

var utils = require('../utils');
var log = require('npmlog');

module.exports = function (http, api, ctx) {
  return function getAccess(callback) {
    var cb;
    var url = 'https://business.facebook.com/';
    var rt = new Promise(function (resolve, reject) {
      cb = (error, token) => token ? resolve(token) : reject(error);
    });

    if (typeof callback == 'function') cb = callback;

    var Referer = url + 'security/twofactor/reauth/?twofac_next=' + encodeURIComponent(url + 'content_management') + '&type=avoid_bypass&app_id=0&save_device=0';

    if (!!ctx.access_token) cb(null, ctx.access_token);
    else {
      utils
        .get(url + 'content_management', ctx.jar, null, ctx.globalOptions, null, {
          noRef: true,
          Origin: url
        })
        .then(function (res) {
          var html = res.body;
          var lsd = utils.getFrom(html, "[\"LSD\",[],{\"token\":\"", "\"}");
          return lsd;
        })
        .then(function (lsd) {        
          if (typeof callback != 'function') 
            throw 'callback must be a function';
          throw {
            error: 'submitCode',
            continue: function submitCode(code) {
              var pCb;
              var rtPromise = new Promise(function (resolve) {
                pCb = (error, token) => resolve(cb(error, token));
              });
              if (typeof code != 'string')
                return pCb({
                  error: 'submitCode',
                  lerror: 'code must be string',
                  continue: submitCode
                });

              http
                .post(url + 'security/twofactor/reauth/enter/', ctx.jar, {
                  approvals_code: code,
                  save_device: true,
                  lsd 
                }, ctx.globalOptions, null, {
                  Referer,
                  Origin: url
                })
                .then(function (res) {
                  var { payload } = JSON.parse(res.body.split(';').pop() || '{}');
                  if (payload && !payload.codeConfirmed)
                    throw {
                      error: 'submitCode',
                      lerror: payload.message,
                      continue: submitCode
                    }
                  
                  return res;
                })
                .then(utils.getAccessFromBusiness(ctx.jar, ctx.globalOptions))
                .then(function (res) {
                  var [html, token] = res;
                  if (!token) 
                    throw {
                      error: 'token-undefined',
                      htmlData: html
                    }
                  ctx.access_token = token;                      
                  return pCb(null, token);
                })
                .catch(function (res) {
                  log.error('getAccess', res.error || res);
                  return pCb(res);
                });

              return rtPromise;
            }
          }        
        })
        .catch(function (res) {
          log.error('getAccess', res.error || res);
          return cb(res);
        });
    }

    return rt;
  }
}
