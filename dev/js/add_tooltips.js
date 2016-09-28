/*
 * This file is the primary script, which is run on every page to inject html elements
 * for tooltip display.
 *
 */

var DEBUG = true;
function log(input, override) {
  chrome.storage.local.get(['_DEVMODE'], function(data) {
    if (data._DEVMODE || DEBUG || override) console.log("DOTATOOLTIPS:", input);
  });
}
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

  log('language set to: ' + LANGUAGE);
  log('update period set to: ' + UPDATE_PERIOD + '/day.');

  var updateThreshold = new Date();
  updateThreshold.setTime(updateThreshold.getTime() - 1*24*60*60*1000/1000000/(UPDATE_PERIOD === undefined ? 1 : UPDATE_PERIOD));

  // check the age of our local copy of the heropedia and update it if it's over a day old
  if (data.heropedia === undefined || data.dotakeywords === undefined) {
    chrome.runtime.sendMessage(
      { target: "updateLocalHeropedia",
        language: LANGUAGE },
        modifyWebpage
    );
  } else {
    modifyWebpage();
    if (data.heropedia.lastUpdate === undefined ||
        new Date(data.heropedia.lastUpdate) < updateThreshold) {
      log("Local Heropedia too old (from "+data.heropedia.lastUpdate+")! Updating now.");
      chrome.runtime.sendMessage({ target: "updateLocalHeropedia", language: LANGUAGE },
          function() { log('Done.'); });
    } else if (data._NEEDS_UPDATE) {
      log("Update queued due to options changes.");
      chrome.runtime.sendMessage({ target: "updateLocalHeropedia", language: LANGUAGE },
          function() { log('Done.'); });
    }
  }
});

// the meat of the webpage manipulation to inject tooltip triggers and .html elements
function modifyWebpage() {
  // load our local copy of the heropedia
  chrome.storage.local.get(["heropedia", "dotakeywords", "_BASE_FONT_SIZE", "_BASE_KEYWORD_SPECIFICITY"], function(data) {
    // build a monster regex query to match for any of the keywords
    var dota_keywords_regex = {
      case_sensitive: Object.keys(data.dotakeywords)
                      .map( function(k) { return (data.dotakeywords[k].case_sensitive ? (data.dotakeywords[k].keyregex ? k : escapeRegExp(k)) : undefined) } )
                      .filter(function(k) { return k !== undefined; })
                      .join('|'),
      case_insensitive: Object.keys(data.dotakeywords)
                      .map( function(k) { return (data.dotakeywords[k].case_sensitive ? undefined : (data.dotakeywords[k].keyregex ? k : escapeRegExp(k))) } )
                      .filter(function(k) { return k !== undefined; })
                      .join('|')
    };

    // handle case where no dictionary entries exist
    dota_keywords_regex.case_sensitive = (dota_keywords_regex.case_sensitive == "" ? undefined : new RegExp('\\b('+dota_keywords_regex.case_sensitive+')\\b', ""));
    dota_keywords_regex.case_insensitive = (dota_keywords_regex.case_insensitive == "" ? undefined : new RegExp('\\b('+dota_keywords_regex.case_insensitive+')\\b', "i"));

    // just a quick output for debugging
    log({'Heropedia': data.heropedia,'Keywords Lookup Dictionary': data.dotakeywords});

    // get the total number of keywords, traverse html text and insert spans for keywords
    var pageData = traverse(document.body);
    pageData.uniqueKeywords = new Set(pageData.keywordsFound);
    pageData.dotaFoundInURL = !!document.URL.match(/dota/gi);
    pageData.specificity =  -(pageData.dotaFoundInURL ? 1 : 0) -
                             (pageData.dotaFoundInText ? 1 : 0) -
                             ((Math.log10(pageData.uniqueKeywords.size / pageData.wordCount) / Math.log10(3)) + 1/Math.log10(3) * 3);

    // update elements with specificity modifier (calculated above)
    $("span.DotaTooltips").attr("specmod", pageData.specificity);
    log(pageData);
    log("Page Dota specificity rated at " + (-1*pageData.specificity) + "\n  " +
          (pageData.dotaFoundInURL ? "1 for 'Dota' in the url\n  " : "0 for 'Dota' not found in url\n  ") +
          (pageData.dotaFoundInText ? "1 for 'Dota' in page text\n  " : "0 for 'Dota' not found in text\n  ") +
          ((Math.log10(pageData.uniqueKeywords.size / pageData.wordCount) / Math.log10(3)) + 1/Math.log10(3) * 3) + " for the number of unique keywords found");
    log(pageData.keywordsFound.length + " Dota keywords found! (" + pageData.uniqueKeywords.size + " unique)", true);

    if (pageData.keywordsFound.length > 0) {
      updateTabFromSettings();
      buildTooltipElements();
    } else {
      // send a message back to background script to update badge text
      chrome.runtime.sendMessage({ target: "updateBadgeText", text: "" });
    }

    // tooltip construction and callbacks
    function buildTooltipElements() {
      // create divs as placeholders for the tooltips
      for (var k = 0, key, newDiv; k < Object.keys(data.heropedia.data).length; k++) {
        key = Object.keys(data.heropedia.data)[k].replace(/data$/gi, "");
        $.get(chrome.extension.getURL("/json/tooltips/"+key+".json"), function(divJSON) {
          newDiv = jsonToDOM(divJSON, document, {});
          newDiv.style["font-size"] = (data._BASE_FONT_SIZE !== undefined ? data._BASE_FONT_SIZE.toString() + "px" : "11px");
          $("body").append(newDiv);
        }, "json");
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
            var value = "";
            switch (attr) {
              case "html":
                $(this)[0].attributes.item(a).value.replace(
                  /\[\[([^\]]*)]]/g,
                  function(match) {
                    value = getPropertyFromLocation(
                              match.substring(2, match.length-2).split("."),
                              tipProperties);
                  });
                // securely reconstruct DOM elements from JSON (originally constructed from parsed from html strings.)
                if (Array.isArray(value))
                  $(this).empty()[0].appendChild(jsonToDOM(value, document, {}));
                else
                  $(this).text(value);
                break;

              default:
                value = $(this)[0].attributes.item(a).value.replace(/\[\[([^\]]*)]]/g,
                  function(match) {
                    return getPropertyFromLocation(
                             match.substring(2, match.length-2).split("."),
                             tipProperties);
                  });
                if (value !== "")
                  if (attr == "text") $(this).text(value);
                  else $(this).attr(attr, value);
                break;
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
      var child, next, keywordsFound = [], dotaFoundInText = false, wordCount = 0;

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
                    wordCount += nodeData.wordCount;
                    child = next;
                }
                break;

            case 3: // Text node
                keywordsFound = keywordsFound.concat(injectSpansForKeywords(node));
                dotaFoundInText = dotaFoundInText || !!node.nodeValue.match(/\bdota\b/gi);
                matchSpaces = node.nodeValue.match(/[ \n\r]+\b/gi);
                wordCount += (matchSpaces !== null ? matchSpaces.length + 1: (node.nodeValue.length > 0 ? 1 : 0));
                break;
        }
      }

      return {"keywordsFound": keywordsFound,
              "dotaFoundInText": dotaFoundInText,
              "wordCount": wordCount};
    }
    function injectSpansForKeywords(textNode) {
      var keyword, match, keywords = [];

      while (textNode) {
        var text = textNode.nodeValue;
        var match = {
          case_sensitive: dota_keywords_regex.case_sensitive !== undefined ? text.match(dota_keywords_regex.case_sensitive) : null,
          case_insensitive: dota_keywords_regex.case_insensitive !== undefined ? text.match(dota_keywords_regex.case_insensitive) : null };

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
          spanInjection.setAttribute("spec", data.dotakeywords[keyword].specificity);
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

// update page font size and content filtering
function updateTabFromSettings() {
  chrome.storage.local.get(["_LANGUAGE", "_BASE_FONT_SIZE", "_BASE_KEYWORD_SPECIFICITY"], function(data) {
    var visible_keywords_count = 0;

    // update div font size
    $("div.DotaTooltip").css({"font-size": (data._BASE_FONT_SIZE !== undefined ? data._BASE_FONT_SIZE : "11px")});

    // update span base specificity and sum up all keywords which aren't filterd (sum spec <= 0)
    $("span.DotaTooltips").each(function() {
      if( (data._BASE_KEYWORD_SPECIFICITY === undefined ? 0 : data._BASE_KEYWORD_SPECIFICITY) +
          parseInt($(this).attr("spec")) +
          parseInt($(this).attr("specmod")) <= 0) visible_keywords_count += 1;
      $(this).attr("specbase", data._BASE_KEYWORD_SPECIFICITY === undefined ? 0 : data._BASE_KEYWORD_SPECIFICITY.toString())
    });

    // send a message back to background script to update badge text
    chrome.runtime.sendMessage({ target: "updateBadgeText", text: (visible_keywords_count > 0 ? visible_keywords_count.toString() : "") });
  });
}

// listen for updating requests from the background script (relayed from options updates)
chrome.runtime.onMessage.addListener(function(request, sender, sendMessage) {
  if (request.target == "updateTab") {
    updateTabFromSettings();
  }
});





// Mozilla solution for loading html from json object
jsonToDOM.namespaces = {
    html: "http://www.w3.org/1999/xhtml",
    xul: "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"
};
jsonToDOM.defaultNamespace = jsonToDOM.namespaces.html;
function jsonToDOM(jsonTemplate, doc, nodes) {
    function namespace(name) {
        var reElemNameParts = /^(?:(.*):)?(.*)$/.exec(name);
        return { namespace: jsonToDOM.namespaces[reElemNameParts[1]], shortName: reElemNameParts[2] };
    }

    // Note that 'elemNameOrArray' is: either the full element name (eg. [html:]div) or an array of elements in JSON notation
    function tag(elemNameOrArray, elemAttr) {
        // Array of elements?  Parse each one...
        if (Array.isArray(elemNameOrArray)) {
            var frag = doc.createDocumentFragment();
            Array.forEach(arguments, function(thisElem) {
                frag.appendChild(tag.apply(null, thisElem));
            });
            return frag;
        }

        // Single element? Parse element namespace prefix (if none exists, default to defaultNamespace), and create element
        var elemNs = namespace(elemNameOrArray);
        var elem = doc.createElementNS(elemNs.namespace || jsonToDOM.defaultNamespace, elemNs.shortName);

        // Set element's attributes and/or callback functions (eg. onclick)
        for (var key in elemAttr) {
            var val = elemAttr[key];
            if (nodes && key == "key") {
                nodes[val] = elem;
                continue;
            }

            var attrNs = namespace(key);
            if (typeof val == "function") {
                // Special case for function attributes; don't just add them as 'on...' attributes, but as events, using addEventListener
                elem.addEventListener(key.replace(/^on/, ""), val, false);
            }
            else {
                // Note that the default namespace for XML attributes is, and should be, blank (ie. they're not in any namespace)
                elem.setAttributeNS(attrNs.namespace || "", attrNs.shortName, val);
            }
        }

        // Create and append this element's children
        var childElems = Array.prototype.slice.call(arguments, 2);
        childElems.forEach(function(childElem) {
            if (childElem != null) {
                elem.appendChild(
                    childElem instanceof doc.defaultView.Node ? childElem :
                        Array.isArray(childElem) ? tag.apply(null, childElem) :
                            doc.createTextNode(childElem));
            }
        });

        return elem;
    }

    return tag.apply(null, jsonTemplate);
}
