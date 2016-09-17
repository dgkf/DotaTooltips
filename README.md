# DotaTooltips
A chrome extension for providing helpful info tooltips for dota-related keywords.

![showcase](https://cloud.githubusercontent.com/assets/18220321/18258201/0e5a899a-7386-11e6-9e37-aebafa703ae4.png)

## Purpose
For anyone unfamiliar, Dota 2 is a very complicated competitive strategy game. It's often acknowledged around July each year for its pinnacle tournament's enormous prize pool. Unfortunately, the game is prohibitively difficult to learn - it has an enormous amount of information that has to be committed to memory to perform at a high level in the game. To help out with this learning curve, I wanted to help those new to the game by keeping necessary information at their fingertips when following online discussions, patch notes or analysis.

As a secondary purpose, this extension also helps to annotate many community acronyms or nicknames for the various characters and items in the game, allowing newcomers to follow veteran conversations without necessitating prior knowledge about the historical names of various elements from the game.

## How you can help!
#### 1. Update the List of Keywords
##### [Update Dictionary Here](https://github.com/dgkf/DotaTooltips/blob/master/dev/json/custom_keywords.json)

Although most keywords are pulled from the Heropedia, many community slang terms or acronyms have to be added manually.

Info you'll need:
* The term you want to add
* The location in the heropedia to point to. To find this...
  1. [Enable Dev Mode](#DevMode)
  2. Open your browser's JavaScript console & navigate to any webpage
  3. An ```Object {Heropedia: Object, Keywords Lookup Dictionary: Object}``` will be written to console which you can explore to find the location to point to.
* How specific to Dota the keyword is (0 is specific to Dota)
* Whether the keyword is case sensitive

#### 2. Save my Stylesheets!
The world of web development is a dark and mysterious place. Making things look pretty is not my expertise, and making things that look pretty with css on multiple browsers adds another layer of complexity to an area I already find difficult. If you want to contribute and you have any familiarity with this line of work, I'd greatly appreciate the help.

There are two stylesheets that are used:
1. [```options.css```](https://github.com/dgkf/DotaTooltips/blob/master/dev/css/options.css), which formats the icon popup options and the options menu in the extensions settings in your browser.
2. [```style_custom.css```](https://github.com/dgkf/DotaTooltips/blob/master/dev/css/style_custom.css), which formats the tooltips. There is also a ```style_valvefaithful.css``` tucked away in there that is unused, but nice to refer back to how these are formatted on [dota2.com](https://www.dota2.com).

## <a name="DevMode"></a>Enabling Dev Mode
Open the extension options or popup window and hover your cursor in the top left corner for 10 seconds. You'll now get added info logged to the JavaScript console in your browser to help debugging and troubleshooting.

![dev_mode](https://cloud.githubusercontent.com/assets/18220321/18610434/27dd93d6-7cd1-11e6-8a9a-8f22f4a8d55b.png)
