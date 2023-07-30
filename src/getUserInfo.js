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

function formatDataGraph(Obj, { userID, res }) {
  if (res.error) Obj[userID] = {};
  else {
    Obj[userID] = {
      id: userID,
      name: res.name,
      shortName: res.short_name || null,
      verified: res.verified != false ? true : false,
      email: res.email || null,
      website: res.website || null,
      follower: !!res.subscribers == true ? res.subscribers.summary.total_count : null,
      lover: res.significant_other || null,
      cover: !!res.cover == true ? res.cover.source : null,
      first_name: res.first_name || null,
      middle_name: res.middle_name || null,
      last_name: res.last_name || null,
      about: res.about || null,
      birthday: res.birthday || null,
      languages: res.languages || [],
      gender: res.gender || null,
      hometown: !!res.hometown == true ? res.hometown.name : null,
      profileUrl: res.link || null,
      location: !!res.location == true ? res.location.name : null,
      username: res.username || null,
      avatar: !!res.picture == true ? res.picture.data.url : null,
      relationship_status: !!res.relationship_status == true ? res.relationship_status : null,
      subscribers: !!res.subscribers == true ? res.subscribers.data : null,
      favorite_athletes: !!res.favorite_athletes == false ? [] : res.favorite_athletes.map(function (v) {
        return {
          name: v.name
        }
      }),
      education: !!res.education == true ? res.education.map(function(v) {
        return {
          type: v.type,
          school: v.school.name
        }
      }) : [],
      work: !!res.work == true ? res.work : []
    }
  }
  return Obj;
}

module.exports = function (http, api, ctx) {
  function handleGetData(userIDs) {
    var cb;
    var uploads = [];
    var rtPromise = new Promise(function (resolve, reject) {
      cb = (error, data) => data ? resolve(data) : reject(error);
    });

    // Getting User Data From GraphAPI In The Loop
    userIDs.map(function (userID) {
      var mainPromise = http
        .get(`https://graph.facebook.com/v1.0/${userID}?fields=name,verified,cover,first_name,email,about,birthday,gender,website,hometown,link,location,quotes,relationship_status,significant_other,username,subscribers.limite(0),short_name,last_name,middle_name,education,picture,work,languages,favorite_athletes&access_token=` + ctx.access_token, ctx.jar)
        .then(utils.parseAndCheckLogin(ctx, http))
        .then(function (res) {
          return { userID, res }
        })
        .catch(function (err) {
          return { userID, res: { error: 404 } }
        });
      return uploads.push(mainPromise);
    });

    // resolve all promise
    Promise
      .all(uploads)
      .then(function (res) {
        return cb(null, res);
      })
      .catch(function (err) {
        return cb(err);
      });
 
    return rtPromise;
  }
  
  return function getUserInfo(userIDs, useGraph, callback) {
    var cb;
    var rtPromise = new Promise(function (resolve, reject) {
      cb = (error, data) => data ? resolve(data) : reject(error);
    });

    if (typeof useGraph == 'function') {
      callback = useGraph;
      useGraph = false;
    }
    if (typeof callback == 'function') cb = callback;
    if (Array.isArray(userIDs) == false) userIDs = [userIDs];

    if (useGraph) {
      if (ctx.access_token == 'NONE') {
        log.error('getUserInfo', 'Cant get access_token, please let the "useGraph" feature is false');
        return cb('Cant get access_token, please let the "useGraph" feature is false');
      }
      handleGetData(userIDs)
        .then(function (res) {
          return cb(null, res.reduce(formatDataGraph, {}));
        })
        .catch(function (err) {
          log.error('getUserInfo', err);
          return cb(err);
        });
    } else {
      var form = {};
      userIDs.map(function(v, i) {
        form["ids[" + i + "]"] = v;
      });
      http
        .post("https://www.facebook.com/chat/user_info/", ctx.jar, form)
        .then(utils.parseAndCheckLogin(ctx, http))
        .then(function(res) {
          if (res.error || res.errors) throw res;
          return cb(null, formatData(res.payload.profile));
        })
        .catch(function(err) {
          log.error("getUserInfo", err);
          return cb(err);
        });
    }

    return rtPromise;
  }
}
