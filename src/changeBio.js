"use strict";

var utils = require("../utils");
var log = require("npmlog");

module.exports = function (http, api, ctx) {
  return function changeBio(bio, publish, callback) {
    var cb;
    var rtPromise = new Promise(function (resolve, reject) {
      cb = function (error) {
        error ? reject(error): resolve();
      }
    });

    if (typeof bio == 'function') {
      callback = bio;
      bio = '';
    }
    if (typeof bio == 'boolean') {
      publish = bio;
      bio = '';
    }
    if (typeof publish == 'function') {
      callback = publish;
      publish = false;
    }
    if (typeof publish != 'boolean') publish = false;
    if (typeof callback == 'function') cb = callback;

    var form = {
      fb_api_req_friendly_name: "ProfileCometSetBioMutation",
      // This doc_is is valid as of May 23, 2020
      doc_id: "2725043627607610",
      variables: JSON.stringify({
        input: {
          bio: bio,
          publish_bio_feed_story: publish,
          actor_id: ctx.userID,
          client_mutation_id: Math.round(Math.random() * 1024).toString()
        },
        hasProfileTileViewID: false,
        profileTileViewID: null,
        scale: 1
      })
    }
    http
      .post("https://www.facebook.com/api/graphql/", ctx.jar, form)
      .then(utils.parseAndCheckLogin(ctx, http))
      .then(function (res) {
        if (res.errors) throw res;
        return cb();
      })
      .catch(function (err) {
        log.error("changeBio", err);
        return cb(err);
      });

    return rtPromise;
  }
}
