'use strict';

var utils = require('../utils.js');
var log = require('npmlog');

module.exports = function (http, api, ctx) {
  function handleUpload(msg, form) {
    var cb;
    var uploads = [];
    var returnPromise = new Promise(function (resolve, reject) {
      cb = error => error ? reject(error) : resolve();
    });

    if (msg.attachments.length > 0) {
      form.image_ids = [];
      form.gif_ids = [];
      form.file_ids = [];
      form.video_ids = [];
      form.audio_ids = [];

      for (let item of msg.attachments) {
        if (!utils.isReadableStream(item)) 
          return cb('Attachment should be a readable stream and not ' + utils.getType(item));

        var httpData = http
          .postFormData('https://upload.facebook.com/ajax/mercury/upload.php', ctx.jar, {
            upload_1024: item,
            voice_clip: 'true'
          })
          .then(utils.parseAndCheckLogin(ctx, http))
          .then(function (res) {
            if (res.error) 
              throw res;

            return res.payload.metadata[0];
          })
          .catch(cb);

        uploads.push(httpData);
      }

      Promise
        .all(uploads)
        .then(function (main) {
          main.forEach(item => {
            var type = Object.keys(item)[0];
            form[type + 's'].push(item[type]);
          });

          return cb();
        })
        .catch(cb);
    } else cb();

    return returnPromise;
  }

  function handleURL(msg, form) {
    var cb;
    var returnPromise = new Promise(function (resolve, reject) {
      cb = error => error ? reject(error) : resolve();
    });

    if (msg.url) {
      form['shareable_attachment[share_type]'] = 100;

       http
         .post('https://www.facebook.com/message_share_attachment/fromURI/', ctx.jar, {
           image_height: 960,
           image_width: 960,
           uri: msg.url
         })
         .then(utils.parseAndCheckLogin(ctx, http))
         .then(function (res) {
           if (res.error) 
             throw res;
           if (!res.payload)
             throw { error: 'Invalid url', res }
           
           form['shareable_attachment[share_params]'] = res.payload.share_data.share_params;
           return cb();
         })
         .catch(cb);
    } else cb();

    return returnPromise;
  }

  function sendContent(threadID, form, isSingleUser, messageAndOTID) {
    var cb;
    var rt = new Promise(function (resolve, reject) {
      cb = (error, event) => event ? resolve(event) : resolve(error);
    });
    
    if (Array.isArray(threadID)) {
      threadID.map((id, i) => {
        return form["specific_to_list[" + i + "]"] = "fbid:" + id;
      });
      form["specific_to_list[" + threadID.length + "]"] = "fbid:" + ctx.userID;
      form["client_thread_id"] = "root:" + messageAndOTID;
    } else if (isSingleUser) {
      form["specific_to_list[0]"] = "fbid:" + threadID;
      form["specific_to_list[1]"] = "fbid:" + ctx.userID;
      form.other_user_fbid = threadID;
    } else form.thread_fbid = threadID;

    if (ctx.globalOptions.pageID) {
      form["specific_to_list[1]"] = "fbid:" + ctx.globalOptions.pageID;
      form.source = 'source:page_unified_inbox';
      form.request_user_id = ctx.globalOptions.pageID;
      form.ephemeral_ttl_mode = 0;
    }

    http
      .post("https://www.facebook.com/messaging/send/", ctx.jar, form)
      .then(utils.parseAndCheckLogin(ctx, http))
      .then(function (res) {
        form = null;
        if (!res)
          throw { error: 'Send Message Fail' }
        if (res.error)
          throw res;

        var event = res.payload.actions.reduce(function (p, v) {
          return {
            threadID: v.thread_fbid || v.other_user_fbid,
            messageID: v.message_id,
            timestamp: v.timestamp
          }
        }, null);
        return cb(null, event);
      })
      .catch(function (error) {
        if (error.error === 1545012)
          log.warn("sendMessage", "Got error 1545012. This might mean that you're not part of the conversation " + threadID);
        else log.error("sendMessage", error);
        if (utils.getType(error) == "Object" && error.error === "Not logged in.") ctx.loggedIn = !1;
        return cb(error);
      });

    return rt;
  }
  
  return function sendMessage(msg, threadID, callback, messageID, isGroup) {
    typeof isGroup != 'boolean' ? isGroup = null : null;
    var cb;
    var returnPromise = new Promise(function (resolve, reject) {
      cb = (error, info) => info ? resolve(info) : reject(error);
    });

    if (typeof threadID == 'function') {
      var error = 'Pass a threadID as a second argument.';
      log.error('sendMessage', error);
      return threadID(error);
    }
    if (typeof callback == 'string') {
      messageID = callback;
      callback = null;
    }
    if (typeof callback == 'function') cb = callback;
    if (typeof messageID != 'string') messageID = null;

    var typeMessage = utils.getType(msg);
    if (typeMessage == 'String' || typeMessage == 'Array')
      msg = {
        body: typeMessage == 'Array' ? JSON.stringify(msg) : msg,
        attachments: [],
        mentions: [],
        sticker: null,
        url: null,
        location: null,
        emoji: null
      }
    else if (typeMessage == 'Object') {
      msg.body ? typeof msg.body == 'object' ? msg.body = JSON.stringify(msg.body) : null : msg.body = '';
      msg.attachments ? !Array.isArray(msg.attachments) ? msg.attachments = [msg.attachments] : null : msg.attachments = [];
      msg.mentions ? !Array.isArray(msg.mentions) ? msg.mentions = [msg.mentions] : null : msg.mentions = [];
      msg.sticker ? isNaN(msg.sticker) ? msg.sticker = null : null : null;
      msg.url ? typeof msg.url != 'string' ? msg.url = null : null : null;
      msg.location ? !Array.isArray(msg.location) ? msg.location = null : null : null;
      msg.emoji ? utils.getType(msg.emoji) == 'Object' ? null : msg.emoji = null : null;
    } else {
      var error = 'Message must be a string or an object, not ' + typeMessage;
      log.error('sendMessage', error);
      return cb(error);
    }

    var typeThread = utils.getType(threadID);
    if (!['Array', 'String', 'Number'].includes(typeThread)) {
      var error = 'ThreadID should be of type number, string, or array and not ' + typeThread;
      log.error('sendMessage', error);
      return cb(error);
    }

    var messageAndOTID = utils.generateOfflineThreadingID();

    var form = {
      client: 'mercury',
      action_type: 'ma-type:user-generated-message',
      author: 'fbid:' + ctx.userID,
      timestamp: Date.now(),
      timestamp_absolute: 'Today',
      timestamp_relative: utils.generateTimestampRelative(),
      timestamp_time_passed: '0',
      is_unread: !1,
      is_cleared: !1,
      is_forward: !1,
      is_filtered_content: !1,
      is_filtered_content_bh: !1,
      is_filtered_content_account: !1,
      is_filtered_content_quasar: !1,
      is_filtered_content_invalid_app: !1,
      is_spoof_warning: !1,
      source: 'source:chat:web',
      'source_tags[0]': 'source:chat',
      body: msg.body,
      html_body: !1,
      ui_push_phase: 'V3',
      status: '0',
      offline_threading_id: messageAndOTID,
      message_id: messageAndOTID,
      threading_id: utils.generateThreadingID(ctx.clientID),
      'ephemeral_ttl_mode:': '0',
      manual_retry_cnt: '0',
      has_attachment: !!(msg.attachments || msg.url || msg.sticker),
      signatureID: utils.getSignatureID(),
      replied_to_message_id: messageID
    }

    handleUpload(msg, form)
      .then(_ => handleURL(msg, form))
      .then(_ => {
        if (msg.sticker) 
          form.sticker_id = msg.sticker;
        if (msg.mentions.length > 0) {
          for (let i in msg.mentions) {
            var { tag, id, fromIndex } = msg.mentions[i];

            if (typeof tag != 'string')
              throw 'Mention tag must be string';
            if (!id || isNaN(id)) 
              throw 'id must be string';

            var offset = msg.body.indexOf(tag, fromIndex || 0);
            if (offset < 0)
              throw 'Mention for "' + tag + '" not found in message string.';

            form['profile_xmd[' + i + '][offset]'] = offset;
            form['profile_xmd[' + i + '][length]'] = tag.length;
            form['profile_xmd[' + i + '][id]'] = id;
            form['profile_xmd[' + i + '][type]'] = 'p';
          }
        }
        if (msg.location) {
          if (msg.location.latitude == null || msg.location.longitude == null)
            throw 'location property needs both latitude and longitude';

          form['location_attachment[coordinates][latitude]'] = msg.location.latitude;
          form['location_attachment[coordinates][longitude]'] = msg.location.longitude;
          form['location_attachment[is_current_location]'] = !!msg.location.current;
        }
        if (msg.emoji) {
          !msg.emoji.emojiSize ? msg.emoji.emojiSize = 'medium' : null;
          if (!['small', 'medium', 'large'].includes(msg.emoji.emojiSize))
            throw 'emojiSize property is invalid';

          if (!msg.emoji.body)
            throw 'emoji is invalid';
          if (form.body != '')
            throw 'body must be empty';
          form.body = msg.emoji.body;
          form['tags[0]'] = 'hot_emoji_size:' + msg.emoji.emojiSize;
        }
      })
      .then(_ => {
        isGroup = Array.isArray(threadID) ? false : typeof isGroup == 'boolean' ? !isGroup : threadID.toString().length < 16;
        return sendContent(threadID, form, isGroup, messageAndOTID);
      })
      .then(info => cb(null, info))
      .catch(function (err) {
        log.error('sendMessage', err);
        return cb(err);
      });

    return returnPromise;
  }
}
