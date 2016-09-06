var _EXTENSION_CONSOLE_NAME = "DOTATOOLTIPS:"
var _HEROPEDIA_BASE_LINK = "https://www.dota2.com/jsfeed/heropediadata?feeds=itemdata,abilitydata,herodata&l=";
var DEBUG = true;
function log(input) { console.log(_EXTENSION_CONSOLE_NAME, input); } // small logging helper

$(document).ready(function() {
  chrome.storage.local.get(["_LANGUAGE", "_UPDATE_PERIOD", "_SCALING_FACTOR"], function(data) {
    $(".DotaTooltipOptions #Language").val(
      (data._LANGUAGE === undefined ? 'english' : data._LANGUAGE));
    $(".DotaTooltipOptions #UpdatePeriod").val(
      (data._UPDATE_PERIOD === undefined ? "24" : data._UPDATE_PERIOD.toString()));
    $(".DotaTooltipOptions .ScalingFactor").val(
      (data._SCALING_FACTOR === undefined ? "18" : data._SCALING_FACTOR.toString()));

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
    $(".DotaTooltipOptions > .ScalingFactor").on("input change", function(event) {
      var newval = parseInt(event.target.value);
      newval = Math.max(6, Math.min(30, newval));
      $(".DotaTooltipOptions > .ScalingFactor").val(newval);
      chrome.storage.local.set( {"_SCALING_FACTOR": newval} );
      data._SCALING_FACTOR = newval;
    });
  });
});



// THESE ARE JUST COPIED FROM add_tooltips.js
// NEED TO MAKE THIS MORE MODULAR SOMEHOW SO THE CODE ISN"T DUPLICATED

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
        keywords[obj[Object.keys(obj)[k]].toLowerCase()] = {location: loc, priority: 1, case_sensitive: false};
      // otherwise continue traversing the heropedia, recursively calling this function for nested objects
      else if (typeof obj[Object.keys(obj)[k]] == 'object'
               && obj[Object.keys(obj)[k]] !== null
               && obj[Object.keys(obj)[k]] !== undefined)
        buildDict(loc.concat(Object.keys(obj)[k]), obj[Object.keys(obj)[k]]);
  }
  buildDict([], data);
  return keywords;
}
