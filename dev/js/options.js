var _EXTENSION_CONSOLE_NAME = "DOTATOOLTIPS:"
var _HEROPEDIA_BASE_LINK = "https://www.dota2.com/jsfeed/heropediadata?feeds=itemdata,abilitydata,herodata&l=";

function log(input, override) {
  chrome.storage.local.get(['_DEVMODE'], function(data) {
    if (data._DEVMODE || override) console.log("DOTATOOLTIPS:", input);
  });
}

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
        chrome.runtime.sendMessage({ target: "updateLocalHeropedia", language: newval }, function() { log("Done.") });
        log("Updating heropedia done!");
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
    });
    $(".DotaTooltipOptions .BaseFontSize").on("change", function(event) {
      var newval = parseInt(event.target.value);
      newval = Math.max(6, Math.min(30, newval));
      data._BASE_FONT_SIZE = newval;
      
      chrome.storage.local.set( {"_BASE_FONT_SIZE": newval} , function() {
        // update scaling of tooltip divs on current page
        chrome.runtime.sendMessage({ target: "updateActiveTab" });
      });
    });

    // keyword specificity
    $(".DotaTooltipOptions > .KeywordSpecificity").on("input change", function(event) {
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
    });
    $(".DotaTooltipOptions > .KeywordSpecificity").on("change", function(event) {
      var newval = parseInt(event.target.value);
      newval = Math.max(-2, Math.min(2, newval));
      data._BASE_KEYWORD_SPECIFICITY = newval;

      chrome.storage.local.set( {"_BASE_KEYWORD_SPECIFICITY": newval}, function() {
        // update specificity on current page
        chrome.runtime.sendMessage({ target: "updateActiveTab" });
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
