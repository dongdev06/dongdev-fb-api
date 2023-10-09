'use strict';

var utils = require('../utils');
var log = require('npmlog');

function formatComment(res) {
  return {
    id: res.feedback_comment_edge.node.id,
    url: res.feedback_comment_edge.node.feedback.url,
    commentCount: res.feedback.display_comments_count
  }
}

module.exports = function (http, api, ctx) {
  function handleUpload(input) {
    var cb;
    var rt = new Promise(function (resolve, reject) {
      cb = (error, info) => error ? reject(error) : resolve(info);
    });

    !Array.isArray(input.attachment) ? input.attachment = [input.attachment] : null;
    var form = [];
    for (let item of input.attachment) {
      if (!utils.isReadableStream(item)) 
        throw 'Attachment should be a readable stream or url, and not' + utils.getType(item);
      var httpPromise = http
        .postFormData('https://www.facebook.com/ajax/ufi/upload/', ctx.jar, {
          profile_id: ctx.userID,
          source: 19,
          target_id: ctx.userID,
          file: item
        })
        .then(utils.parseAndCheckLogin(ctx, http))
        .then(function (res) {
          if (res.error) throw res;
          return {
            media: {
              id: res.payload.fbid
            }
          }
        });
      form.push(httpPromise);
    }

    Promise
      .all(form)
      .then(info => cb(null, info));

    return rt;
  }
  
  function handleAttachment(form, input) {
    var cb;
    var rt = new Promise(function (resolve, reject) {
      cb = error => error ? reject(error) : resolve();
    });

    if (!input.attachment) cb();
    else {
      handleUpload(input)
        .then(function (res) {
          res.map(item => form.input.attachments.push(item));

          return cb();
        });
    }
    
    return rt;
  }

  function handleUrl(form, input) {
    if (input.url && typeof input.url == 'string') {
      form.input.attachments.push({
        link: {
          external: {
            url: input.url
          }
        }
      });
    }
  }

  function handleMention(input, form) {
    if (input.mentions) {
      input.mentions instanceof Array ? null : input.mentions = [input.mentions];
      for (let item of input.mentions) {
        var { tag, id } = item;
        if (typeof tag != 'string')
          throw 'Mention tag must be string';
        if (!id)
          throw 'id must be string';
        var offset = input.body.indexOf(tag, item.fromIndex || 0);
        if (offset < 0)
          throw 'Mention for "' + tag + '" not found in message string.';

        form.input.message.ranges.push({
          entity: { id },
          length: tag.length,
          offset
        });
      }
    }
  }

  function createContent(vari) {
    var cb;
    var rt = new Promise(function (resolve, reject) {
      cb = (error, info) => info ? resolve(info) : reject(error);
    });

    http
      .post('https://www.facebook.com/api/graphql/', ctx.jar, {
        fb_api_caller_class: 'RelayModern',
        fb_api_req_friendly_name: 'useCometUFICreateCommentMutation',
        variables: JSON.stringify(vari),
        server_timestamps: true,
        doc_id: 6687401108025716
      })
      .then(utils.parseAndCheckLogin(ctx, http))
      .then(function (res) {
        if (res.errors) throw res;
        return cb(null, formatComment(res.data.comment_create));
      })
      .catch(cb);

    return rt;
  }
  
  return function createCommentPost(input, postID, replyCommentID, callback, isGroup) {
    var cb;
    typeof isGroup != 'boolean' ? isGroup = false : null;
    var rt = new Promise(function (resolve, reject) {
      cb = (error, info) => error ? reject(error) : resolve(info);
    });

    if (typeof postID == 'function') {
      var error = 'Pass a postID as a string argument.';
      log.error('createCommentPost', error);
      return postID(error);
    }
    if (typeof callback == 'string') {
      replyCommentID = callback;
      callback = null;
    }
    if (typeof callback == 'function') cb = callback;
    if (typeof replyCommentID != 'string') replyCommentID = null;

    var typeMsg = utils.getType(input);
    var typePID = utils.getType(postID);

    if (typeMsg == 'String' || typeMsg == 'Array') input = { body: input }
    else if (typeMsg != 'Object' || Object.keys(input).length < 1) {
      var error = "Message should be of type string or object or array and not " + typeMsg;
      log.error('createCommentPost', error);
      return cb(error);
    }
    if (typePID != 'String') {
      var error = 'postID should be of type string, not ' + typeTID;
      log.error('createCommentPost', error);
      return cb(error);
    }

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
        reply_comment_parent_fbid: isNaN(replyCommentID) ? replyCommentID : Buffer.from('comment:' + postID + '_' + replyCommentID).toString('base64'),
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
      focusCommentID: isNaN(replyCommentID) ? Buffer.from(replyCommentID, 'base64').toString().split('_')[1] : replyCommentID
    }

    handleAttachment(form, input)
      .then(_ => handleUrl(form, input))
      .then(_ => handleMention(input, form))
      .then(_ => createContent(form))
      .then(info => cb(null, info))
      .catch(function (err) {
        log.error('createCommentPost', err);
        return cb(err);
      });

    return rt;
  }
}
