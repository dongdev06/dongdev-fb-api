'use strict';

var utils = require('../utils.js');
var log = require('npmlog');

module.exports = function (http, api, ctx) {
  function formatData(resData) {
    var result = []
    var edges = resData.data.sticker_search.sticker_results.edges;
    for (let value of edges) {
      result.push({
        id: value.node.id,
        image: value.node.image,
        package: value.node.pack != null ? {
          name: value.node.pack.name,
          id: value.node.pack.id
        } : {},
        label: value.node.label
      });
    }
    return result;
  }
  
  return function searchStickers(query, callback) {
    var cb;
    var returnPromise = new Promise(function (resolve, reject) {
      cb = function (error, data) {
        data ? resolve(data) : reject(error);
      }
    });

    if (typeof callback == 'function') cb = callback;
    if (typeof query != 'string') return cb('Query is not string');

    var form = {
      fb_api_req_friendly_name: 'StickersFlyoutTagSelectorQuery',
      variables: JSON.stringify({
        stickerWidth: 64,
        stickerHeight: 64,
        stickerInterface: 'messages',
        query
      }),
      doc_id: '4642836929159953'
    }
    http
      .post('https://www.facebook.com/api/graphql/', ctx.jar, form)
      .then(utils.parseAndCheckLogin(ctx, http))
      .then(function (resData) {
        return cb(null, formatData(resData));
      })
      .catch(function (err) {
        log.error('searchStickers', err);
        return cb(err);
      });

    return returnPromise;
  }
}
