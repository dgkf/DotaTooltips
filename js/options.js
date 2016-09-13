var _EXTENSION_CONSOLE_NAME = "DOTATOOLTIPS:"
var _HEROPEDIA_BASE_LINK = "https://www.dota2.com/jsfeed/heropediadata?feeds=itemdata,abilitydata,herodata&l=";
var DEBUG = true;
function log(input) { console.log(_EXTENSION_CONSOLE_NAME, input); } // small logging helper

$(document).ready(function() {
  chrome.storage.local.get(["_LANGUAGE", "_UPDATE_PERIOD", "_BASE_FONT_SIZE", "_BASE_KEYWORD_SPECIFICITY", "_DEVMODE"], function(data) {
    // language callbacks
    $(".DotaTooltipOptions #Language").change(function(event) {
      var newval = event.target.value;
      if (event.target.value != data._LANGUAGE) {
        chrome.storage.local.set( {"_LANGUAGE": newval } );

        data._LANGUAGE = newval;
        chrome.storage.local.set( {"_NEEDS_UPDATE": true } );
        log("Updating heropedia due to language change.");
        updateHeropedia(newval);
        log("Updating heropedia done!");
        chrome.storage.local.set( {"_NEEDS_UPDATE": false } );
      }
    });

    // update frequency callbacks
    $(".DotaTooltipOptions #UpdatePeriod").change(function(event) {
      var newval = parseInt(event.target.value);
      chrome.storage.local.set( {"_UPDATE_PERIOD": newval} );
      data._UPDATE_PERIOD = newval;
    });

    // scaling
    $(".DotaTooltipOptions .BaseFontSize").on("input change", function(event) {
      var newval = parseInt(event.target.value);
      newval = Math.max(6, Math.min(30, newval));
      $(".DotaTooltipOptions .BaseFontSize").val(newval);
      chrome.storage.local.set( {"_BASE_FONT_SIZE": newval} );
      data._BASE_FONT_SIZE = newval;

      // update scaling of tooltip divs on current page
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.executeScript(tabs[0].id, {file: "js/update_tab_settings.js"});
      });
    });

    // keyword specificity
    $(".DotaTooltipOptions > .KeywordSpecificity").on("input change", function(event) {
      console.log('here');
      var newval = parseInt(event.target.value);

      switch(newval) {
        case 2:
          $(".KeywordSpecificityInfo").text("strict");
          break;
        case 1:
          $(".KeywordSpecificityInfo").text("conservative");
          break;
        case 0:
          $(".KeywordSpecificityInfo").text("moderate (default)");
          break;
        case -1:
          $(".KeywordSpecificityInfo").text("liberal");
          break;
        case -2:
          $(".KeywordSpecificityInfo").text("Dota everywhere!");
          break;
      }

      newval = Math.max(-2, Math.min(2, newval));
      chrome.storage.local.set( {"_BASE_KEYWORD_SPECIFICITY": newval} );
      data._BASE_KEYWORD_SPECIFICITY = newval;

      // update specificity on current page
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.executeScript(tabs[0].id, {file: "js/update_tab_settings.js"});
      });
    });
    $(".DotaTooltipOptions > .KeywordSpecificity").hover(
      function(event) { $(".KeywordSpecificityInfo").css("opacity", 1); },
      function(event) { $(".KeywordSpecificityInfo").css("opacity", 0); }
    );

    // dev moderate
    $("#DevMode").on("change", function(event) {
      if (event.target.checked !== data._DEVMODE) {
        chrome.storage.local.set( {"_DEVMODE": event.target.checked });
        data._DEVMODE = event.target.checked;
      }
    })


    $(".DotaTooltipOptions #Language").val(
      (data._LANGUAGE === undefined ? 'english' : data._LANGUAGE));
    $(".DotaTooltipOptions #UpdatePeriod").val(
      (data._UPDATE_PERIOD === undefined ? "1" : data._UPDATE_PERIOD.toString()));
    $(".DotaTooltipOptions .BaseFontSize").val(
      (data._BASE_FONT_SIZE === undefined ? "11" : data._BASE_FONT_SIZE.toString()));
    $(".DotaTooltipOptions > .KeywordSpecificity").val(
      (data._BASE_KEYWORD_SPECIFICITY === undefined ? "0" : data._BASE_KEYWORD_SPECIFICITY.toString())).trigger("input");
    $("#DevMode").attr("checked",
      (data._DEVMODE === undefined ? false: data._DEVMODE));
  });
});



/*
 * THESE ARE JUST COPIED FROM add_tooltips.js
 * NEED TO MAKE THIS MORE MODULAR SOMEHOW SO THE CODE ISN'T DUPLICATED
 *
 * As far as I can tell, the best way to do this is make a background script
 * However, I believe it would be better to just keep the code duplicated instead of having the
 * additional process running. If anyone has more input, I'd greatly appreciate it.
 *
 * Another option would be to use a chrome.tab.executeScript call to run it on the active tab
 * However, this wouldn't allow someone to change language with the extensions tab open
 *
 */

// helper function to update our local copy of the heropedia
function updateHeropedia(LANGUAGE) {
 $.getJSON(_HEROPEDIA_BASE_LINK + (LANGUAGE === undefined ? 'english' : LANGUAGE), function(data) {
   // update local copy of heropedia
   chrome.storage.local.set( {"heropedia": {"data": data, "lastUpdate": (new Date()).toJSON()}} );

   // update local keyword dictiony from updated heropedia and custom keywords
   $.getJSON(chrome.extension.getURL("/json/custom_keywords.json"), function(custom_keywords) {
     chrome.storage.local.set(
       {"dotakeywords": buildDotaKeywordDictionary(custom_keywords[(LANGUAGE === undefined ? 'english' : LANGUAGE)], data)}
     );
    });
  });
}

// builds a dictionary of { keyword: {location: [String], priority: int, case_sensitive: Bool }}
function buildDotaKeywordDictionary(keywords, data) {
  keywords = (keywords !== undefined ? keywords : {} );

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
  return keywords;
}
