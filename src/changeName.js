"use strict";

var utils = require('./../utils.js');
var log = require('npmlog');

module.exports = function (defaultFuncs, api, ctx) {
  return function chanegName(Obj, password, format, callback) {
    var cb;
    var returnPromise = new Promise(function (resolve, reject) {
      cb = function (err) {
        if (err) reject(err);
        resolve();
      }
    });

    if (!Obj.first_name || !Obj.last_name)
    if (typeof format == 'function') {
      callback = format;
      format = 'complete';
    }
    if (!['complete', 'standard', 'reversed'].includes(format)) format = 'complete';
    if (!password || typeof password == 'function' || password == format) return cb('Error: password is not defined');

    var form = {
      display_format: format,
      save_password: password,
      primary_first_name: Obj.first_name,
      primary_middle_name: !!Obj.middle_name == true ? Obj.middle_name : '',
      primary_last_name: Obj.last_name
    }
    defaultFuncs
      .post('https://www.facebook.com/ajax/settings/account/name.php', ctx.jar, form, ctx.globalOptions)
      .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
      .then(function (res) {
        if (res.jsmods.require[1][3][1]) {
          return cb('Error: password is wrong or not defined');
        }
        return cb();
      })
      .catch((err) => {
        log.error('changeName', err);
        return cb(err);
      });

    return returnPromise;
  }
}
