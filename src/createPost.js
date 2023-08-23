'use strict';

var utils = require('../utils');
var log = require('npmlog');

module.exports = function (http, api, ctx) {
  function uploadAttachment(attachment) {
    var cb;
    var uploads = [];
    var rt = new Promise(function (resolve, reject) {
      cb = (error, files) => files ? resolve(files) : reject(error);
    });

    attachment.map(function (stream) {
      if (!utils.isReadableStream(stream)) 
        return cb("Attachment should be a readable stream and not " + utils.getType(stream));

      var httpPro = http
        .postFormData('https://upload.facebook.com/ajax/react_composer/attachments/photo/upload', ctx.jar, {
          source: 8,
          profile_id: ctx.userID,
          waterfallxapp: 'comet',
          farr: stream,
          upload_id: 'jsc_c_6'
        })
        .then(utils.parseAndCheckLogin(ctx, http))
        .then(function (res) {
          if (res.error) 
            throw res;

          return res.payload;
        })
        .catch(cb);

      return uploads.push(httpPro);
    });

    Promise
      .all(uploads)
      .then(res => cb(null, res))
      .catch(cb);

    return rt;
  }
  
  function handleUpload(msg, form) {
    var cb;
    var rt = new Promise(function (resolve, reject) {
      cb = error => error ? reject(error) : resolve(error);
    });

    if (!msg.attachment) cb();
    else {
      if (!Array.isArray(msg.attachment)) msg.attachment = [msg.attachment];
      uploadAttachment(msg.attachment)
        .then(function (res) {
          res.map(function (c) {
            if (!c) return;
            return form.input.attachments.push({
              photo: {
                id: c.photoID
              }
            });
          });
          return cb();
        })
        .catch(cb);
    }

    return rt;
  }

  function handleMention(msg, form) {
    if (!msg.mentions) return;

    msg.mentions.map(function (mention) {
      var { id, tag } = mention;

      if (typeof tag != 'string')
        throw 'Mention tag must be string';
      if (!id)
        throw 'id must be string';
      var offset = msg.body.indexOf(tag, mention.fromIndex || 0);
      if (offset < 0)
        throw 'Mention for "' + tag + '" not found in message string.';

      return form.input.message.ranges.push({
        entity: { id },
        length: tag.length,
        offset
      });
    });
  }

  function createContent(vari) {
    var cb;
    var rt = new Promise(function (resolve, reject) {
      cb = (error, url) => url ? resolve(url) : reject(url);
    });
    
    var form = {
      fb_api_req_friendly_name: 'ComposerStoryCreateMutation',
      variables: JSON.stringify(vari),
      server_timestamps: true,
      doc_id: '6255089511280268'
    }

    http
      .post('https://www.facebook.com/api/graphql/', ctx.jar, form)
      .then(utils.parseAndCheckLogin(ctx, http))
      .then(res => cb(null, res))
      .catch(cb);

    return rt;
  }
  
  return function createPost(msg, callback) {
    var cb;
    var rt = new Promise(function (resolve, reject) {
      cb = (error, url) => url ? resolve(url) : reject(error);
    });

    if (typeof msg == 'function') {
      var error = 'Msg must be a string or object and not function';
      log.error('createPost', error);
      return msg(error);
    }
    if (typeof callback == 'function') cb = callback;

    var typeMsg = utils.getType(msg);
    if (!['Object', 'String'].includes(typeMsg)) {
      var error = 'Msg must be a string or object and not ' + typeMsg;
      log.error('createPost', error);
      return cb(error);
    } else if (typeMsg == 'String') msg = { body: msg };
    if (msg.allowUserID && !Array.isArray(msg.allowUserID)) msg.allowUserID = [msg.allowUserID];
    else if (!msg.allowUserID) msg.allowUserID = [];

    var sessionID = utils.getGUID();
    var base = [
      'EVERYONE',
      'FRIENDS',
      'SELF'
    ];
    var form = {
      input: {
        composer_entry_point: "inline_composer",
        composer_source_surface: msg.groupID ? "group" : "timeline",
        composer_type: msg.groupID ? "group" : "timeline",
        idempotence_token: sessionID + "_FEED",
        source: "WWW",
        attachments: [],
        audience: msg.groupID ? {
          to_id: msg.groupID
        } : {
          privacy: {
            allow: msg.allowUserID,
            base_state: msg.allowUserID.length > 0 ? base[2] : (base[msg.baseState - 1] || base[0]),
            deny: [],
            tag_expansion_state: "UNSPECIFIED"
          }
        },
        message: {
          ranges: [],
          text: msg.body ? typeof msg.body == 'object' ? JSON.stringify(msg.body) : msg.body : '' 
        },
        with_tags_ids: [],
        inline_activities: [],
        explicit_place_id: 0,
        text_format_preset_id: 0,
        logging: {
          composer_session_id: sessionID
        },
        navigation_data: {
          attribution_id_v2: msg.groupID ? "CometGroupDiscussionRoot.react,comet.group,tap_search_bar," + Date.now() + ",909538,2361831622," : "ProfileCometTimelineListViewRoot.react,comet.profile.timeline.list,via_cold_start," + Date.now() + ",796829,190055527696468,"
        },
        tracking: [null],
        event_share_metadata: { 
          surface: "newsfeed"
        },
        actor_id: ctx.globalOptions.pageID || ctx.userID,
        client_mutation_id: Math.round(Math.random() * 19).toString()
      },
      displayCommentsFeedbackContext: null,
      displayCommentsContextEnableComment: null,
      displayCommentsContextIsAdPreview: null,
      displayCommentsContextIsAggregatedShare: null,
      displayCommentsContextIsStorySet: null,
      feedLocation: msg.groupID ? "GROUP" : "TIMELINE",
      feedbackSource: 0,
      focusCommentID: null,
      gridMediaWidth: 230,
      groupID: null,
      scale: 1,
      privacySelectorRenderLocation: "COMET_STREAM",
      renderLocation: msg.groupID ? "group" : "timeline",
      useDefaultActor: false,
      inviteShortLinkKey: null,
      isFeed: false,
      isFundraiser: false,
      isFunFactPost: false,
      isGroup: !!msg.groupID,
      isEvent: false,
      isTimeline: !msg.groupID,
      isSocialLearning: false,
      isPageNewsFeed: !!ctx.globalOptions.pageID,
      isProfileReviews: false,
      isWorkSharedDraft: false,
      UFI2CommentsProvider_commentsKey: msg.groupID ? "CometGroupDiscussionRootSuccessQuery" : "ProfileCometTimelineRoute",
      hashtag: null,
      canUserManageOffers: false,
      __relay_internal__pv__CometUFIIsRTAEnabledrelayprovider: false,
      __relay_internal__pv__IsWorkUserrelayprovider: false,
      __relay_internal__pv__IsMergQAPollsrelayprovider: false,
      __relay_internal__pv__StoriesArmadilloReplyEnabledrelayprovider: false,
      __relay_internal__pv__StoriesRingrelayprovider: false
    }

    try {
      handleMention(msg, form);
    } catch (e) {
      log.error('createPost', e);
      return cb(e);
    }

    handleUpload(msg, form)
      .then(_ => createContent(form))
      .then(function (res) {
        if (res.error || res.errors) throw res;

        return cb(null, res.data.story_create.story.url);
      })
      .catch(function (err) {
        log.error('createPost', err);
        return cb(err);
      });

    return rt;
  }
}
