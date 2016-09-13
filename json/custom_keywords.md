# Custom Keywords JSON Format
This file specifies details about additional keywords to identify and what they should direct to in the heropedia.

### Example format
```json
{
  "english": {
    "keyword": {
      "location": [],
      "specificity": 1,
      "case_sensitive": false
    }
  }
}
```

### Detailed Format explaination
```language``` must match a value from the language selection in the options menu. These are all lowercase english names for the localization region.

```keyword ``` of the term to add

``` location ``` is the position of the information to draw within the heropedia data (can be viewed in the browser console with development turned on.)
eg: The data in ```heropedia.herodata.ancient_apparition``` would become ```["herodata", "ancient_apparition"]```

```specificity``` (Default: ```0```) A number representing how specific the term is to its Dota related meaning. Words like "am" may mean Anti-mage in a very specific context, but it's unlikely it's Dota related in most usages.
Lower values indicated highest priority and will always be used for tooltips. What each higher value represents is still under development.
  ##### Current Plan of Action:
  * **0** always highlighted
  * **1** highlighted if "Dota" is found in the page text
  * **2** highlighted if "Dota" is found in the page url
  * **3+** included for expansion, for the time being they will behave like 2

```case_sensitive``` (Default: ```false```) whether the term should match case with the keyword in the keyword dictionary.
