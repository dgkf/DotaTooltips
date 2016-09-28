var _HEROPEDIA_BASE_LINK = "https://www.dota2.com/jsfeed/heropediadata?feeds=itemdata,abilitydata,herodata&l=";
function log(input, override) {
  chrome.storage.local.get(['_DEVMODE'], function(data) {
    if (data._DEVMODE || override) console.log("DOTATOOLTIPS:", input);
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
      // build heropedia from request - any html strings are converted to JSON objects for secure reconstruction
      var heropedia = { "data": sterilizeJSONnestedHTML(jQuery.parseJSON(req_data.target.responseText)),
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

    // convert html in heropedia to JSON objects that can be safely inserted into webpage DOM
    function sterilizeJSONnestedHTML(obj) {
      for (var k = 0; k < Object.keys(obj).length; k++) {
        if (typeof obj[Object.keys(obj)[k]] == 'object' &&
                   obj[Object.keys(obj)[k]] !== null &&
                   obj[Object.keys(obj)[k]] !== undefined) {
          obj[Object.keys(obj)[k]] = sterilizeJSONnestedHTML(obj[Object.keys(obj)[k]]);
        } else if (isHTML(obj[Object.keys(obj)[k]])) {
          obj[Object.keys(obj)[k]] = HTMLtoJSON(obj[Object.keys(obj)[k]]);
        }
      }

      return obj;
    }

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


// helper function for quick-and-dirty test for html in heropedia (html is very mundane, I think this catch-all should be good enough)
// source: http://stackoverflow.com/questions/15458876/check-if-a-string-is-html-or-not#15458987
var isHTML = RegExp.prototype.test.bind(/(<([^>]+)>)/i);

// Helper function to convert HTML strings to JSON objects for insertion into webpages
// from http://stackoverflow.com/questions/12980648/map-html-to-json
function HTMLtoJSON(element, json) {
    // If string convert to document Node
    if (typeof element === "string") {
      element = element.trim();
      element = '<div>' + element + '</div>'; // wrap html in element so it can be parsed

      if (window.DOMParser) {
        parser = new DOMParser();
        docNode = parser.parseFromString(element, "text/xml");
      } else { // Microsoft strikes again
        docNode = new ActiveXObject("Microsoft.XMLDOM");
        docNode.async = false;
        docNode.loadXML(element);
      }
      element = docNode.firstChild;
    }

    //Recursively loop through DOM elements and assign properties to object
    function treeHTML(element) {
      var object = ['html:' + element.nodeName];

      var attributes = {};
      if (element.attributes != null && element.attributes.length)
        for (var i = 0; i < element.attributes.length; i++)
          attributes[element.attributes[i].nodeName] = element.attributes[i].nodeValue;
      object.push(attributes);

      var nodeList = element.childNodes;
      if (nodeList != null && nodeList.length)
        for (var i = 0; i < nodeList.length; i++)
          if (nodeList[i].nodeType == 3) object.push(nodeList[i].nodeValue);
          else object.push(treeHTML(nodeList[i]));

      return object;
    }

    treeObject = treeHTML(element);

    return (json) ? JSON.stringify(treeObject) : treeObject;
}
