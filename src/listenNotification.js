'use strict';

var utils = require('../utils.js');
var log = require('npmlog');

function notification(http, ctx, count, loopMs, callback) {
  if (utils.getType(count) != 'Number') count = 5;
  if (utils.getType(loopMs) != 'Number') loopMs = 60000;

  var getMinute = (timeMs) => {
    var ms = timeMs.getTime();
    return Math.ceil(((new Date()).getTime() - ms) / loopMs);
  }

  function formatDataGraph(data) {
    var res = data.viewer.notifications_page.edges;
    var Obj = [];

    for (let i of res) {
      if (i.node.row_type != 'NOTIFICATION') continue;
      var timestamp = i.node.notif.creation_time.timestamp * 1000;
      if (getMinute(new Date(timestamp)) <= 1) continue;
      Obj.push({
        id: i.node.notif.notif_id,
        type: i.node.notif.notif_type,
        body: i.node.notif.body,
        url: i.node.notif.url,
        attachments: i.node.notif.notif_attachments,
        timestamp
      });
    }

    return Obj;
  }
  
  var interval = setInterval(function (form) {
    http
      .post('https://www.facebook.com/api/graphql/', ctx.jar, form)
      .then(utils.parseAndCheckLogin(ctx, http))
      .then(function (data) {
        return callback(null, formatDataGraph(data.data));
      })
      .catch(function (err) {
        log.error('listenNotification', err);
        return callback(err);
      });
  }, loopMs, {
    fb_api_req_friendly_name: "CometNotificationsDropdownQuery",
    fb_api_caller_class: "RelayModern",
    doc_id: "5025284284225032",
    variables: JSON.stringify({
      count,
      environment: "MAIN_SURFACE",
      menuUseEntryPoint: true,
      scale: 1
    })
  });

  return function stopListen() {
    return clearInterval(interval);
  }
}

module.exports = function (http, api, ctx) {
  return function GraphNoti(count, loopMs, callback) {
    var cb;
    var rtPromise = new Promise(function (resolve, reject) {
      cb = function (error, rCb) {
        rCb ? resolve(rCb) : reject(error);
      }
    });

    if (typeof count == 'function') {
      callback = count;
      count = 5;
    }
    if (typeof loopMs == 'function') {
      callback = loopMs;
      loopMs = 60000;
    }
    if (typeof callback != 'function') cb('callback is not a function');

    try {
      var stopListen = notification(http, ctx, count, loopMs, callback);
      cb(null, stopListen);
    } catch (err) {
      log.error('listenNotification', err);
      cb(err);
    }

    return rtPromise;
  }
}
