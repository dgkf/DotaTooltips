/*
 * This file is the primary script, which is run on every page to inject html elements
 * for tooltip display.
 *
 */

var _EXTENSION_CONSOLE_NAME = "DOTATOOLTIPS:"
var _HEROPEDIA_BASE_LINK = "https://www.dota2.com/jsfeed/heropediadata?feeds=itemdata,abilitydata,herodata&l=";
var DEBUG = false;
function log(input) { console.log(_EXTENSION_CONSOLE_NAME, input); } // small logging helper

// try to load a saved version of the heropedia data. If it doesn't exist or it's too old, get a new copy and save it in local storage. Also builds a dictionary of keywords and their contents' location in the heropedia
chrome.storage.local.get(
["heropedia",
 "dotakeywords",
 "_LANGUAGE",
 "_UPDATE_PERIOD",
 "_NEEDS_UPDATE",
 "_DEVMODE"],
function(data) {
  var LANGUAGE = (data._LANGUAGE === undefined ? 'english' : data._LANGUAGE);
  var UPDATE_PERIOD = (data._UPDATE_PERIOD === undefined ? 1 : data._UPDATE_PERIOD);
  DEBUG = DEBUG || (data._DEVMODE === undefined ? false : true);

  if (DEBUG) {
    log('language set to: ' + LANGUAGE);
    log('update period set to: ' + UPDATE_PERIOD + '/day.');
  }

  var updateThreshold = new Date();
  updateThreshold.setDate(updateThreshold.getDate() - 1/(UPDATE_PERIOD === undefined ? 1 : UPDATE_PERIOD));

  // check the age of our local copy of the heropedia and update it if it's over a day old
  if (data.heropedia === undefined || data.dotakeywords === undefined) {
    log("Creating local copy of the Heropedia!");
    updateHeropedia(LANGUAGE, function() { if (DEBUG) log('Done.'); modifyWebpage(); });
  } else {
    modifyWebpage();

    if (data.heropedia.lastUpdate === undefined ||
        new Date(data.heropedia.lastUpdate) < updateThreshold) {
      log("Local Heropedia too old (from "+data.heropedia.lastUpdate+")! Updating now.");
      updateHeropedia(LANGUAGE);
    } else if (data._NEEDS_UPDATE) {
      log("Update queued due to options changes.");
      updateHeropedia(LANGUAGE);
      chrome.storage.local.set( {"_NEEDS_UPDATE": false} );
    }
  }
});

// the meat of the webpage manipulation to inject tooltip triggers and .html elements
function modifyWebpage() {
  // load our local copy of the heropedia
  chrome.storage.local.get(["heropedia", "dotakeywords", "_BASE_FONT_SIZE", "_BASE_KEYWORD_SPECIFICITY"], function(data) {
    // build a monster regex query to match for any of the keywords
    var dota_keywords_regex = {
      case_sensitive: new RegExp('\\b('+Object.keys(data.dotakeywords)
                                          .map(function(k) { return data.dotakeywords[k].case_sensitive ? k : undefined })
                                          .filter(function(k) { return k !== undefined; })
                                          .map(function(k) { return data.dotakeywords[k].keyregex ? k : escapeRegExp(k) })
                                          .join('|')
                                          +')\\b', ""),
      case_insensitive: new RegExp('\\b('+Object.keys(data.dotakeywords)
                                          .map(function(k) { return !data.dotakeywords[k].case_sensitive ? k : undefined })
                                          .filter(function(k) { return k !== undefined; })
                                          .map(function(k) { return data.dotakeywords[k].keyregex ? k : escapeRegExp(k) })
                                          .join('|')
                                          +')\\b', "i") };

    // just a quick output for debugging
    if (DEBUG) { log({'Heropedia': data.heropedia,'Keywords Lookup Dictionary': data.dotakeywords}); }

    // get the total number of keywords, traverse html text and insert spans for keywords
    var pageData = traverse(document.body);
    pageData.uniqueKeywords = new Set(pageData.keywordsFound);
    pageData.dotaFoundInURL = !!document.URL.match(/dota/gi);
    pageData.specificity =  -(pageData.dotaFoundInURL ? 1 : 0) -
                             (pageData.dotaFoundInText ? 1 : 0) -
                             Math.floor(Math.log10(pageData.uniqueKeywords.size) / Math.log10(5));

    $("span.DotaTooltips").attr("specmod", pageData.specificity);
    if (DEBUG) {
      log(pageData);
      log("Page Dota specificity rated at " + (-1*pageData.specificity) + "\n  " +
            (pageData.dotaFoundInURL ? "1 for 'Dota' in the url\n  " : "0 for 'Dota' not found in url\n  ") +
            (pageData.dotaFoundInText ? "1 for 'Dota' in page text\n  " : "0 for 'Dota' not found in text\n  ") +
            Math.floor(Math.log10(pageData.uniqueKeywords.size) / Math.log10(5)) + " for the number of unique keywords found");
      log(pageData.keywordsFound.length + " Dota keywords found! (" + pageData.uniqueKeywords.size + " unique)");
    }
    if (pageData.keywordsFound.length > 0) buildTooltipElements();

    // tooltip construction and callbacks
    function buildTooltipElements() {
      // create divs as placeholders for the tooltips
      for (var k = 0, key, newDiv; k < Object.keys(data.heropedia.data).length; k++) {
        key = Object.keys(data.heropedia.data)[k].replace(/data$/gi, "");
        $.get(chrome.extension.getURL("/html/tooltips/"+key+".html"), function(divHTML) {
          newDiv = jQuery.parseHTML(divHTML);
          $(newDiv).css({"font-size": (data._BASE_FONT_SIZE !== undefined ? data._BASE_FONT_SIZE.toString() + "px" : "11px")});
          $("body").append(newDiv);
        }, "html");
      }

      // associate callbacks for hover actions
      $(".DotaTooltips").hover(
        // function to call on enter
        function(event) {
          var keyword_sensitivity = parseInt(event.target.attributes.spec.value) +
                                    parseInt(event.target.attributes.specmod.value) +
                                    parseInt(event.target.attributes.specbase.value);

          if (keyword_sensitivity <= 0) {
            var dataLocation = event.target.attributes.loc.value.split(".");
            var tipProperties = getPropertyFromLocation(dataLocation, data.heropedia.data);
            var tipDiv = $("div.DotaTooltip_"+dataLocation[0].replace(/data$/gi, ""));
            tipProperties.objname = dataLocation[dataLocation.length-1];

            buildTooltip(tipDiv, tipProperties);
            positionTooltip(event, tipDiv);
          }
        },
        // function to call on leave
        function(event) {
          hideTooltips(event)
        }
      );
    }
    function buildTooltip(tipDiv, tipProperties) {
      // loop through all elements in tooltip and look for linked attributes to update
      tipDiv.find("*").each(function() {
        for (var a = 0; a < $(this)[0].attributes.length; a++) {
          if ($(this)[0].attributes.item(a).nodeName.startsWith("linked-")) {
            // get the property that the element is drawn from
            var attr = $(this)[0].attributes.item(a).nodeName.replace("linked-", "");

            // get value from linked- attribute, filling in properties in double brackets
            // e.g. <span linked-text="[[a.a]] + [[a.b]]"></span> will become
            //      <span linked-text="[[a.a]] + [[a.b]]">1 + 2</span>
            // for tip_properties = {a: {a: 1, b: 2}};
            value = $(this)[0].attributes.item(a).value.replace(
              /\[\[([^\]]*)]]/g,
              function(match) {
                return getPropertyFromLocation(
                         match.substring(2, match.length-2).split("."),
                         tipProperties);
              });

            // update html elements based on value
            // if the element attribute is 'text' update the inner html
            // otherwise update the attribute (e.g. linked-class will update class attribute)
            if (value !== undefined) {
              switch (attr) {
                case "text":
                  $(this).html(value);
                  break;
                default:
                  $(this).attr(attr, value);
                  break;
              }
            }
          }
        }
      });
    };
    function positionTooltip(event, tipDiv) {
      // handle some edge cases
      // no cooldown specified
      var cooldown;
      cooldown = $(".cooldownMana span").first();
      if (cooldown[0] !== undefined)
        cooldown.parent().css({"display": cooldown[0].textContent == "false" || cooldown[0].textContent == "" ? "none" : "block"});
      cooldown = $(".DotaTooltip .abilityCMB").first();
      if (cooldown[0] !== undefined)
        cooldown.css({"display": cooldown[0].innerHTML == "" ? "none" : "block"});

      // figure out where the best place to put it is...
      var space = { top: $(event.target)[0].getBoundingClientRect().top,
                    right: $(window).width() - $(event.target)[0].getBoundingClientRect().right,
                    bottom: $(window).height() - $(event.target)[0].getBoundingClientRect().bottom,
                    left: $(event.target)[0].getBoundingClientRect().left };

      if (space.top > tipDiv.outerHeight(true) || (space.top > space.right && space.top > space.left && space.top > space.bottom)) {
        tipDiv.css({"top": $(event.target).offset().top - tipDiv.outerHeight(true) +
                                $(document.body).outerHeight() - $(document.body).outerHeight(true), // jquery .offset() doesn't account for body margin/padding
                         "left": Math.min(
                                   Math.max(
                                     $(event.target).offset().left - (tipDiv.outerWidth(true) - $(event.target).width()) * 0.5 +
                                     $(document.body).outerWidth() - $(document.body).outerWidth(true),
                                     0),
                                   $(window).width() - tipDiv.outerWidth(true) +
                                   $(document.body).outerWidth() - $(document.body).outerWidth(true)) });
      } else if (space.bottom > tipDiv.outerHeight(true) || (space.bottom > space.top && space.bottom > space.right && space.bottom > space.left)) {
        tipDiv.css({"top": $(event.target).offset().top + $(event.target).height() +
                                $(document.body).outerHeight() - $(document.body).outerHeight(true),
                         "left": Math.min(
                                   Math.max(
                                     $(event.target).offset().left - (tipDiv.outerWidth(true) - $(event.target).width()) * 0.5 +
                                     $(document.body).outerWidth() - $(document.body).outerWidth(true),
                                     0),
                                   $(window).width() - tipDiv.outerWidth(true) +
                                   $(document.body).outerWidth() - $(document.body).outerWidth(true)) });
      } else if (space.right > tipDiv.outerWidth(true) || (space.right > space.top && space.right > space.bottom && space.right > space.left)) {
        tipDiv.css({"top": Math.min(
                                  Math.max($(event.target).offset().top - (tipDiv.outerHeight(true) - $(event.target).height()) * 0.5 +
                                    $(document.body).outerHeight() - $(document.body).outerHeight(true),
                                    $(window).scrollTop()),
                                  $(window).height() + $(window).scrollTop() - tipDiv.outerHeight(true) +
                                  $(document.body).outerHeight() - $(document.body).outerHeight(true)),
                         "left": $(event.target).offset().left + $(event.target).width() + $(document.body).outerWidth() - $(document.body).outerWidth(true) });
      } else if (space.left > tipDiv.outerWidth(true) || (space.left > space.top && space.left > space.right && space.left > space.bottom)) {
        tipDiv.css({"top": Math.min(
                                  Math.max($(event.target).offset().top - (tipDiv.outerHeight(true) - $(event.target).height()) * 0.5 +
                                    $(document.body).outerHeight() - $(document.body).outerHeight(true),
                                    $(window).scrollTop()),
                                  $(window).height() + $(window).scrollTop() - tipDiv.outerHeight(true) +
                                  $(document.body).outerHeight() - $(document.body).outerHeight(true)),
                         "left": $(event.target).offset().left - tipDiv.outerWidth(true) + $(document.body).outerWidth() - $(document.body).outerWidth(true) });
      }  else {
        tipDiv.css({"top": $(event.target).offset().top - tipDiv.outerHeight(true) +
                                $(document.body).outerHeight() - $(document.body).outerHeight(true),
                         "left": $(event.target).offset().left - (tipDiv.outerWidth(true) - $(event.target).width() * 0.5) * 0.5 +
                                 $(document.body).outerWidth() - $(document.body).outerWidth(true) });
      }

      // display div
      tipDiv.css({"visibility": "visible", "opacity": 0.95});
    }
    function hideTooltips(event) {
      $("div.DotaTooltip").css({"visibility": "hidden", "opacity": 0});
    }

    // html text element manipulation
    function traverse(node) {
      var child, next, keywordsFound = [], dotaFoundInText = false;

      // make sure we're not editing webpage scripts - especially that pesky 'Return' skill
      if (node.tagName != "SCRIPT") {
        switch ( node.nodeType ) {
            case 1:  // Element
            case 9:  // Document
            case 11: // Document fragment
                child = node.firstChild;
                while (child) {
                    next = child.nextSibling;
                    nodeData = traverse(child);
                    keywordsFound = keywordsFound.concat(nodeData.keywordsFound);
                    dotaFoundInText = dotaFoundInText || nodeData.dotaFoundInText;
                    child = next;
                }
                break;

            case 3: // Text node
                keywordsFound = keywordsFound.concat(injectSpansForKeywords(node));
                dotaFoundInText = dotaFoundInText || !!node.nodeValue.match(/\bdota\b/gi);
                break;
        }
      }
      return {"keywordsFound": keywordsFound,
              "dotaFoundInText": dotaFoundInText};
    }
    function injectSpansForKeywords(textNode) {
      var keyword, match, keywords = [];

      while (textNode) {
        var text = textNode.nodeValue;
        var match = { case_sensitive: text.match(dota_keywords_regex.case_sensitive),
                      case_insensitive: text.match(dota_keywords_regex.case_insensitive) };

        if (match.case_sensitive || match.case_insensitive) {
          keyword = match.case_sensitive ? match.case_sensitive[0] : match.case_insensitive[0].toLowerCase();
          match = match.case_sensitive ? match.case_sensitive : match.case_insensitive;
          keywords.push(keyword);

          // split text node at keyward
          var textNodeAfterKeyword = textNode.splitText(match.index);
          textNodeAfterKeyword.nodeValue = textNodeAfterKeyword.nodeValue.substring(match[0].length);
          // create a span for the tooltip
          var spanInjection = document.createElement('span');
          spanInjection.appendChild(document.createTextNode(match[0]));
          spanInjection.className = "DotaTooltips";
          spanInjection.setAttribute("spec",
            data.dotakeywords[keyword].specificity);
          spanInjection.setAttribute("specbase",
            (data._BASE_KEYWORD_SPECIFICITY === undefined ? 0 : data._BASE_KEYWORD_SPECIFICITY));
          spanInjection.setAttribute("loc", data.dotakeywords[keyword].location.join("."));

          // insert the newly created span element
          textNode.parentNode.insertBefore(spanInjection, textNodeAfterKeyword);

          // update our target text node to continue looking for more keywords
          textNode = textNodeAfterKeyword;
        }  else {
          textNode = null;
          return keywords;
        }
      }
    }

    // credit: http://stackoverflow.com/questions/3446170/escape-string-for-use-in-javascript-regex#6969486
    function escapeRegExp(str) {
      return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
    }
    function getPropertyFromLocation(loc, obj) {
      for (var i = 0; i < loc.length; i++) obj = obj[loc[i]];
      return obj;
    }
  });
}

// helper function to update our local copy of the heropedia
function updateHeropedia(LANGUAGE, callback) {
  var heropedia_req = new XMLHttpRequest();
  heropedia_req.addEventListener("load", function(req_data) {
    // update local copy of heropedia
    chrome.storage.local.set(
      {"heropedia": {"data": jQuery.parseJSON(req_data.target.responseText),
                     "lastUpdate": (new Date()).toJSON()} }
    );

    chrome.storage.local.get(['heropedia'], function(data) {
      // update local keyword dictionary from updated heropedia and custom keywords
      $.getJSON(chrome.extension.getURL("/json/custom_keywords.json"), function(custom_keywords) {
        chrome.storage.local.set(
          {"dotakeywords": buildDotaKeywordDictionary(custom_keywords[(LANGUAGE === undefined ? 'english' : LANGUAGE)], data.heropedia.data)},
          finished_callback
        );
      });

      function finished_callback() {
        if (callback !== undefined) callback();
      }
    });
  });
  heropedia_req.open("GET", _HEROPEDIA_BASE_LINK + (LANGUAGE === undefined ? 'english' : LANGUAGE));
  heropedia_req.send();
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
