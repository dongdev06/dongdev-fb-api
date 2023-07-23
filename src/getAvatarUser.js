"use strict";

var utils = require('./../utils.js');
var log = require('npmlog');

module.exports = function (http, api, ctx) {
  function handleAvatar(userIDs, height, width) {
    var cb;
    var uploads = [];
    var rtPromise = new Promise(function (resolve, reject) {
      cb = function (error, data) {
        data ? resolve(data) : reject(error);
      }
    });

    for (let i = 0; i < userIDs.length; i++) {
      var mainPromise = http
        .get(`https://graph.facebook.com/${userIDs[i]}/picture?height=${height}&width=${width}&redirect=false&access_token=` + ctx.access_token, ctx.jar)
        .then(utils.parseAndCheckLogin(ctx, http))
        .then(function (res) {
          return res.data.url;
        })
        .catch(function (err) {
          return cb(err);
        });
      uploads.push(mainPromise);
    }

    // resolve all promises
    Promise
      .all(uploads)
      .then(function (res) {
        var data = {};
        for (let i = 0; i < userIDs.length; i++) data[userIDs[i]] = res[i];
        return cb(null, data);
      })
      .catch(function (err) {
        return cb(err);
      });

    return rtPromise;
  }
  
  return function getAvatarUser(userIDs, size, callback) {
    var cb;
    var rtPromise = new Promise(function (resolve, reject) {
      cb = function (err, resData) {
        resData ? resolve(resData) : reject(err);
      }
    });

    if (typeof size == 'function') {
      callback = size;
      size = [1500, 1500];
    }
    if (Array.isArray(size) == false && isNaN(parseInt(size)) == false) size = [size, size];
    if (Array.isArray(size) && size.length == 1) size = [size[0], size[0]];
    else size = [1500, 1500];
    if (typeof callback == 'function') cb = callback;
    if (Array.isArray(userIDs) == false) userIDs = [userIDs];
    var [height, width] = size;
    if (ctx.access_token == 'NONE') return cb('Cant get access_token');
    
    handleAvatar(userIDs, height, width)
      .then(function (res) {
        return cb(null, res);
      })
      .catch(function (err) {
        log.error('getAvatarUser', err);
        return cb(err);
      });

    return rtPromise;
  }
}
