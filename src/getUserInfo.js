"use strict";

var utils = require("../utils");
var log = require("npmlog");

function formatData(data) {
  var retObj = {};

  for (var prop in data) {
    // eslint-disable-next-line no-prototype-builtins
    if (data.hasOwnProperty(prop)) {
      var innerObj = data[prop];
      retObj[prop] = {
        name: innerObj.name,
        firstName: innerObj.firstName,
        vanity: innerObj.vanity,
        thumbSrc: innerObj.thumbSrc,
        profileUrl: innerObj.uri,
        gender: innerObj.gender,
        type: innerObj.type,
        isFriend: innerObj.is_friend,
        isBirthday: !!innerObj.is_birthday,
				searchTokens: innerObj.searchTokens,
				alternateName: innerObj.alternateName,
      };
    }
  }

  return retObj;
}

module.exports = function (defaultFuncs, api, ctx) {
  return function getUserInfo(userIDs, callback) {
    var cb;
    var returnPromise = new Promise(function (resolve, reject) {
      cb = function (error, resData) {
        if (err) reject(error);
        resolve(resData);
      }
    });

    if (typeof callback == 'function') cb = callback;
    if (Array.isArray(userIDs) == false) userIDs = [userIDs];

    var form = {};
    userIDs.map(function(v, i) {
      form["ids[" + i + "]"] = v;
    });
    defaultFuncs
      .post("https://www.facebook.com/chat/user_info/", ctx.jar, form)
      .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
      .then(function(resData) {
        if (resData.error) {
          log.error("getUserInfo", resData.error);
          return cb(resData);
        }
        return cb(null, formatData(resData.payload.profiles));
      })
      .catch(function(err) {
        log.error("getUserInfo", err);
        return cb(err);
      });

    return returnPromise;
  };
};
