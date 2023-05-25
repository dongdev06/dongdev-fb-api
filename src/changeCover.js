"use strict";

var utils = require('./../utils.js');
var log = require("npmlog");
var bluebird = require("bluebird");

module.exports = function (defaultFuncs, api, ctx) {
  function handleUpload(image, cb) {
    var uploads = [];
    var form = {
      profile_id: ctx.userID,
      photo_source: 57,
      av: ctx.userID,
      file: image
    };

    uploads.push(
      defaultFuncs
        .postFormData("https://www.facebook.com/profile/picture/upload/", ctx.jar, form, {})
        .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
        .then(function (resData) {
          if (resData.errors) {
            return cb(resData.errors);
          }
          return resData;
        })
    );
    // resolve all promises
    bluebird
      .all(uploads)
      .then(function (resData) {
        cb(null, resData);
      })
      .catch(function (err) {
        log.error("handleUpload", err);
        return cb(err);
      });
  }

  return function changeCover(image, callback) {
    var cb;
    var returnPromise = new Promise(function (resolve, reject) {
      cb = function (err) {
        if (err) reject(err);
        resolve();
      }
    });
    
    if (callback && typeof callback == 'function') var cb = callback;
    if (!utils.isReadableStream(image)) return cb("Image is not a readable stream");

    handleUpload(image, function (err, payload) {
      if (err) return cb(err);
      var form = {
        fb_api_caller_class: "RelayModern",
        fb_api_req_friendly_name: "ProfileCometCoverPhotoUpdateMutation",
        variables: JSON.stringify({
          input: {
            attribution_id_v2: `ProfileCometCollectionRoot.react,comet.profile.collection.photos_by,unexpected,${Date.now()},770083,,;ProfileCometCollectionRoot.react,comet.profile.collection.photos_albums,unexpected,${Date.now()},470774,,;ProfileCometCollectionRoot.react,comet.profile.collection.photos,unexpected,${Date.now()},94740,,;ProfileCometCollectionRoot.react,comet.profile.collection.saved_reels_on_profile,unexpected,${Date.now()},89669,,;ProfileCometCollectionRoot.react,comet.profile.collection.reels_tab,unexpected,${Date.now()},152201,,`,
            cover_photo_id: payload[0].payload.fbid,
            focus: {
              x: 0.5,
              y: 1
            },
            target_user_id: ctx.userID,
            actor_id: ctx.userID, 
            client_mutation_id: Math.round(Math.random() * 19).toString()
          },
          scale: 1,
          contextualProfileContext: null
        }),
        server_timestamps: !0,
        doc_id: "8247793861913071"
      }
      
      defaultFuncs
        .post('https://www.facebook.com/api/graphql', ctx.jar, form)
        .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
        .then(function (res) {
          if (res.errors) {
            log.error('changeCover', res.errors);
            return cb(res.errors);
          }
          return cb();
        })
        .catch((err) => {
          log.error("changeCover", err);
          return cb(err);
        });
    });
    
    return returnPromise;
  }
}
