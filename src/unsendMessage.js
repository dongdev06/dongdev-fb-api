"use strict";

var utils = require("../utils");
var log = require("npmlog");

module.exports = function (http, api, ctx) {
  return function unsendMessage(messageID, callback) {
    var cb;
    var rt = new Promise(function (resolve, reject) {
      cb = error => error ? reject(error) : resolve();
    });

    if (typeof callback == 'function') cb = callback;
    if (typeof messageID == 'function' || typeof messageID != 'string') {
      var error = 'messageID must be string';
      log.error('unsendMessage', error);
      return typeof messageID == 'function' ? messageID(error) : cb(error);
    }

    http
      .post('https://www.facebook.com/messaging/unsend_message/', ctx.jar, {
        message_id: messageID
      })
      .then(utils.parseAndCheckLogin(ctx, http))
      .then(function (res) {
        if (res.error)
          throw res;
        return cb();
      })
      .catch(function (err) {
        log.error('unsendMessage', err);
        return cb(err);
      });

    return rt;
  }
}
