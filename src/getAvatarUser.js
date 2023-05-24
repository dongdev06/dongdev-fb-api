"use strict";

var utils = require('./../utils.js');
var log = require('npmlog');

module.exports = function (defaultFuncs, api, ctx) {
  async function handleGet(userIDs, height, width, cb) {
    var form = {};
    for (let userID of userIDs) {
      try {
        var res = JSON.parse((await defaultFuncs.get(`https://graph.facebook.com/${userID}/picture?height=${height}&width=${width}&redirect=false&access_token=${ctx.access_token}`, ctx.jar, null, ctx.globalOptions)).body);
        form[userID] = res.data.url; 
      } catch (e) {
        return cb(e);
      }
    }

    return cb(null, form);
  }
  
  return function getAvatarUser(userIDs, size, callback) {
    var cb;
    var returnPromise = new Promise(function (resolve, reject) {
      cb = function (err, resData) {
        if (err) reject(err);
        resolve(resData);
      }
    });

    if (typeof size == 'function') {
      callback = size;
      size = [1500, 1500];
    }
    if (Array.isArray(size) == false && isNaN(parseInt(size)) == false) size = [size, size];
    if (Array.isArray(size) && size.length == 1) size = [size[0], size[0]];
    if (typeof callback == 'function') cb = callback;
    if (Array.isArray(userIDs) == false) userIDs = [userIDs];
    var [height, width] = size;

    try {
      if (ctx.access_token == 'NONE') return cb('Error: cant get access_token');
      handleGet(userIDs, height, width, function (err, data) {
        if (err) {
          log.error('handleGet', err);
          return cb(err);
        }
        return cb(null, data);
      });
    } catch (e) {
      log.error('getAvatarUser', e.message || e);
      return cb(e);
    }

    return returnPromise;
  }
}
