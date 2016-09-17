var _HEROPEDIA_BASE_LINK = "https://www.dota2.com/jsfeed/heropediadata?feeds=itemdata,abilitydata,herodata&l=";
function log(input, override) {
  chrome.storage.local.get(['_DEVMODE'], function(data) {
    if (data._DEVMODE || override || true) console.log("DOTATOOLTIPS:", input);
  });
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {

  // for updating of the icon badge
  if (request.target == "updateBadgeText") {
    chrome.browserAction.setBadgeBackgroundColor({tabId: sender.tab.id, color: "#322"});
    chrome.browserAction.setBadgeText({tabId: sender.tab.id, text: request.text});
  }

  // for updating of the local version of heropedia and keyword dictionary
  else if (request.target == "updateLocalHeropedia") {
    log("Creating local copy of the Heropedia!");

    var heropedia_req = new XMLHttpRequest();
    heropedia_req.addEventListener("load", function(req_data) {
      // build heropedia from request
      var heropedia = { "data": jQuery.parseJSON(req_data.target.responseText),
                        "lastUpdate": (new Date()).toJSON()}
      // update local copy of heropedia
      chrome.storage.local.set({"heropedia": heropedia});
      // update keywords dictionary with new heropedia and return updated values
      $.getJSON(chrome.extension.getURL("/json/custom_keywords.json"), function(custom_keywords) {
        // build new dictionary
        var dotakeywords = buildDotaKeywordDictionary(
                             custom_keywords[(request.language === undefined ? 'english' : request.language)],
                             heropedia.data);
        // set it in local storage and trigger callback once all values have been updated
        chrome.storage.local.set({"dotakeywords": dotakeywords}, function() { sendResponse(); });
        chrome.storage.local.set({"_NEEDS_UPDATE": false});
      });
    });
    heropedia_req.open("GET", _HEROPEDIA_BASE_LINK + (request.language === undefined ? 'english' : request.language));
    heropedia_req.send();

    // builds a dictionary of { keyword: {location: [String], priority: int, case_sensitive: Bool }}
    function buildDotaKeywordDictionary(additional_keywords, data) {
      keywords = {};

      // traverses heropedia to builds a dictionary of {keyword: location} for all dname entries
      function buildDict(loc, obj) {
        for (var k = 0; k < Object.keys(obj).length; k++)
          // if the property is 'dname', add the value of that property as a key to the dictionary with a value of its location in the heropedia
          if (Object.keys(obj)[k] == 'dname')
            keywords[obj[Object.keys(obj)[k]].toLowerCase()] = {location: loc, specificity: 0, case_sensitive: false};
          // otherwise continue traversing the heropedia, recursively calling this function for nested objects
          else if (typeof obj[Object.keys(obj)[k]] == 'object'
                   && obj[Object.keys(obj)[k]] !== null
                   && obj[Object.keys(obj)[k]] !== undefined)
            buildDict(loc.concat(Object.keys(obj)[k]), obj[Object.keys(obj)[k]]);
      }

      buildDict([], data);
      jQuery.extend(true, keywords, additional_keywords);
      return keywords;
    }

    // return true so that the send response is sent asynchronously (once all values have been updated)
    return true;
  }

  // for updating active tab's keyword filtering and font size
  else if (request.target == "updateActiveTab") {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {target: "updateTab"});
    });
  }

});
