/*
 * This file is called to update display settings on an active page.
 * This includes the font size of the .DotaTooltip divs, governing all font scaling
 *
 */

chrome.storage.local.get(["_LANGUAGE", "_BASE_FONT_SIZE", "_BASE_KEYWORD_SPECIFICITY"], function(data) {
  $("div.DotaTooltip").css({"font-size": (data._BASE_FONT_SIZE !== undefined ? data._BASE_FONT_SIZE : "12px")});
  $("span.DotaTooltips").each(function() {
    $(this).attr("specbase", data._BASE_KEYWORD_SPECIFICITY.toString())
  });
});
