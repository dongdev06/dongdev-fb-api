'use strict';

var utils = require('../utils');
var log = require('npmlog');

module.exports = function (http, api, ctx) {
  function handleUpload(input, form) {
    var cb;
    var rt = new Promise(function (resolve, reject) {
      cb = error => error ? reject(error) : resolve();
    });

    if (!input.attchment) cb();
    else {
      input.attachment = !Array.isArray(input.attachment) ? [input.attachment] : input.attachment;
      var uploads = [];
      for (let image of input.attachment) {
        if (!utils.isReadableStream(image))
          return cb('image should be a readable stream and not ' + utils.getType(image));
        var httpPromise = http
          .postFormData('https://www.facebook.com/ajax/ufi/upload/', ctx.jar, {
            profile_id: ctx.userID,
            source: 19,
            target_id: ctx.userID,
            file: image
          })
          .then(utils.parseAndCheckLogin(ctx, http))
          .then(function (res) {
            if (res.errors || res.error || !res.payload) 
              throw res;

            return {
              media: {
                id: res.payload.id
              }
            }
          })
          .catch(cb);
        uploads.push(httpPromise);
      }

      Promise
        .all(uploads)
        .then(function (res) {
          for (let item of res) 
            form.input.attachments.push(item);

          return cb();
        })
        .catch(cb);
    }

    return rt;
  }

  function handleMention(input, form) {
    if (!input.mentions) return;
    input.mentions = !Array.isArray(input.mentions) ? [input.mentions] : input.mentions;
    for (let mention of input.mentions) {
      var { tag, id, fromIndex } = mention;
      if (typeof tag != 'string')
        throw 'Mention tag must be string';
      if (!id)
        throw 'id must be string';
      var offset = input.body.indexOf(tag, fromIndex || 0);
      if (offset < 0)
        throw 'Mention for "' + tag + '" not found in message string.';
      form.input.message.ranges.push({
        entity: { id },
        length: tag.length,
        offset
      });
    }
  }

  function handleUrl(input, form) {
    if (!input.url && typeof input.url == 'string') return;
    form.input.attachments = [
      {
        link: {
          external: {
            url: input.url
          }
        }
      }
    ];
  }

  function handleSticker(input, form) {
    if (!input.sticker && !isNaN(input.sticker)) return;
    form.input.attachments = [
      {
        media: {
          id: input.sticker
        }
      }
    ];
  }

  function createContent(form) {
    var cb;
    var rt = new Promise(function (resolve, reject) {
      cb = (error, info) => error ? reject(error) : resolve(info);
    });

    http
      .post('https://www.facebook.com/api/graphql/', ctx.jar, {
        fb_api_caller_class: 'RelayModern',
        fb_api_req_friendly_name: 'useCometUFICreateCommentMutation',
        variables: JSON.stringify(form),
        server_timestamps: true,
        doc_id: 6687401108025716
      })
      .then(utils.parseAndCheckLogin(ctx, http))
      .then(function (res) {
        if (res.errors) 
          throw res;
        var res = res.data.comment_create;
        var info = {
          id: res.feedback_comment_edge.node.id,
          url: res.feedback_comment_edge.node.feedback.url,
          commentCount: res.feedback.display_comments_count.count
        }
        return cb(null, info);
      })
      .catch(cb);

    return rt;
  }
  
  return function createCommentPost(input, postID, callback, replyCommentID) {
    var cb;
    var rt = new Promise(function (resolve, reject) {
      cb = (error, info) => error ? reject(error) : resolve(info);
    });

    if (typeof input == 'function') {
      callback = input;
      input = null;
    }
    if (typeof postID == 'function') {
      callback = postID;
      postID = null;
    }
    if (typeof callback == 'string') {
      replyCommentID = callback;
      callback = null;
    }
    if (typeof callback == 'function') cb = callback;
    if (typeof replyCommentID != 'string') replyCommentID = null;

    var type = utils.getType(input);
    if (type == 'String') 
      input = { 
        body: input 
      }
    else if (type != 'Object') 
      return cb('input should be an object or string, not' + type);
    if (typeof postID != 'string')
      return cb('postID should be a string');

    var form = {
      feedLocation: 'PERMALINK',
      feedbackSource: 2,
      groupID: null,
      input: {
        client_mutation_id: Math.round(Math.random() * 19).toString(),
        actor_id: ctx.userID,
        attachments: [],
        feedback_id: Buffer.from('feedback:' + postID).toString('base64'),
        formatting_style: null,
        message: {
          ranges: [],
          text: input.body ? typeof input.body == 'object' ? JSON.stringify(input.body) : input.body : '' 
        }, 
        reply_comment_parent_fbid: replyCommentID ? isNaN(replyCommentID) ? replyCommentID : Buffer.from('comment:' + postID + '_' + replyCommentID).toString('base64') : null,
        reply_target_clicked: !!replyCommentID,
        attribution_id_v2: 'CometSinglePostRoot.react,comet.post.single,via_cold_start,' + Date.now() + ',253913,,',
        vod_video_timestamp: null,
        is_tracking_encrypted: true,
        tracking: [],
        feedback_source: 'OBJECT',
        idempotence_token: 'client:' + utils.getGUID(),
        session_id: utils.getGUID()
      },
      inviteShortLinkKey: null,
      renderLocation: null,
      scale: 1,
      useDefaultActor: false,
      focusCommentID: null
    }
    handleUpload(input, form)
      .then(_ => handleMention(input, form))
      .then(_ => handleUrl(input, form))
      .then(_ => handleSticker(input, form))
      .then(_ => createContent(form))
      .then(info => cb(null, info))
      .catch(function (err) {
        log.error('createCommentPost', err);
        return cb(err);
      });
    
    return rt;
  }
}
