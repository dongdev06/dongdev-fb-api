"use strict";

var utils = require('./../utils.js');
var log = require('npmlog');

module.exports = function (http, api, ctx) {
  function handleAvatar(userIDs, height, width) {
    var cb;
    var uploads = [];
    var rtPromise = new Promise(function (resolve, reject) {
      cb = (error, data) => data ? resolve(data) : reject(error);
    });

    // Getting User Data From GraphAPI In The Loop
    userIDs.map(function (v) {
      var mainPromise = http
        .get(`https://graph.facebook.com/${v}/picture?height=${height}&width=${width}&redirect=false&access_token=` + ctx.access_token, ctx.jar)
        .then(utils.parseAndCheckLogin(ctx, http))
        .then(function (res) {
          return { 
            userID: v, 
            url: res.data.url 
          }
        })
        .catch(function (err) {
          return cb(err);
        });
      uploads.push(mainPromise);
    });

    // resolve all promises
    Promise
      .all(uploads)
      .then(function (res) {
        return cb(null, res.reduce(function (Obj, { userID, url }) {
          Obj[userID] = url;
          return Obj;
        }, {}));
      })
      .catch(function (err) {
        return cb(err);
      });

    return rtPromise;
  }
  
  return function getAvatarUser(userIDs, size, callback) {
    var cb;
    var rtPromise = new Promise(function (resolve, reject) {
      cb = (err, resData) => resData ? resolve(resData) : reject(err);
    });

    if (typeof size == 'function') {
      callback = size;
      size = [1500, 1500];
    }
    if (Array.isArray(size) == false && utils.getType(Number(size)) == 'Number') size = [size, size];
    else if (Array.isArray(size) && size.length == 1 && utils.getType(Number(size[0])) == 'Number') size = [size[0], size[0]];
    else size = [1500, 1500];
    if (typeof callback == 'function') cb = callback;
    if (Array.isArray(userIDs) == false) userIDs = [userIDs];
    var [height, width] = size;
    if (ctx.access_token == 'NONE') {
      log.error('getAvatarUser', 'Cant get access_token');
      return cb('Cant get access_token')
    };
    
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
