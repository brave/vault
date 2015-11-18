// request/response should use compression
{
  "version": "2.0", // protocol version

  // geo-targeting information
  "loc": {
    "country": "US",
    "region": "FL",
    "city": "Winter Park",
    "msa": "5960",
    "dma": "534",
    "postcode": "32792"
  },

  "rtb": false, // enable or disable real-time bidding

  // intent signals
  "categories": {
    "5": { // category id
      "period": [ // was there a trigger for the category during the specified period
        // these are bucketed to increase "K" and prevent categories
        // from becoming a psuedo-identifer. For very small categories
        // we may want to limit this even further
        "day", // during the last 24 hours
        "week", // > 24 hours and <= 7 days
        "month", // > 7 days and <= 30 days
        "quarter" // > 30 days and <= 90 days
      ]
    },
    "6": { 
      "period": [
        "week" // missing periods are assumed to be false
      ],
    },
    "10": { "period": [ "month" ]}
  },
  // because we want to provide more relevant ads, we should not just pass through search terms here
  // instead, we should generate keywords based on user behavior. This can be used for things
  // like brand preferences and other specifics within a category
  "keywords": {
    "BMW": { // keyword
      "period": [ "day" ] // see categories
    },
    "Orlando Trip": { "period": [ "day" ] }
  },
  // urls were removed because they don't provide intent information 
  // that wouldn't be better conveyed by keywords
  

  // publisher ad placements for the page
  "placements": {
    "domain": "forbes.com", // current page domain - optional (should only be used for Comscore top 200 or similar)
    "content_types": ["image/jpeg","video/mp4"], // allowable ad content types (user may not want video ads for instance)
    "tiles": [
      {
        "tid": 1, // a unique identifier for this ad on the page
        "tsize": "728x90", // the ad size
        "visible": true, // is the placement at least 50% visible (default false)
        "above_the_fold": true, // is the placement 100% visible before scrolling (default false)
        "ad_count": 3, // how many ads should be returned for this tile (default 1 - we will use this to both cache ads and provide a large enough selection to deal with downvoted ads)
        // CPM or Intent - should the returned ads attempt to optimize CPM or use as many different intent signals as possible (default CPM)
        // Intent would be used if the intent data is associated with several filtered ads. The content provider will provide ads for as many different intents as possible
        // to minimize the chance that all returned ads are filtered
        "ad_strategy": "CPM" 
      },
      {"tid": 2, "tsize": "300x250", "visible": true, "above_the_fold": true, "count": 3},
      {"tid": 3, "tsize": "300x250", "visible": true, "above_the_fold": false, "count": 3}
    ]
  }
}


// response
{

  // ad information by placement
  "placements": [
    {
      "tid": 1,
      "ads": [
        {
          "id": "ad1id", // a unique id that will always be associated with this ad
          // targeting information fields
          "categories": ["5"], // targeted categories
          "keywords": ["BMW"], // targeted keywords
          "geo": ["region"], // targeted geo information
          "brand": "BMW USA", // what brand information is associated with this ad (optional, but ad may be rejected if empty)
    
          // campaign related fields (optional)
          // all fields within campaign are also optional
          // except for the fields within cpm and fcap if those
          // fields are included
          "campaign": { 
            // We want to provide some information to the 
            // browser to allow users to minimize the number of intent
            // signals they expose for privacy reasons, but
            // we want to bucket this information to prevent 
            // fradulent signals meant to maximize CPMs
            // We may also just want to collect and possibly remove this to 
            // from the response and provide a generic map of intent 
            // signal => cpm bucket for all browsers to use
            // available values are high, med and low
            "cpm": "med",
            "id": "my_awesome_campaign", // advertiser campaign id
            "fcap": { // per-user immpression limits
              "limit": 3, // maximum number of times this ad should be displayed during the period
              "period": 86400, // number of seconds over which the limit applies
            }
          },

          // how long can we cache the ad in seconds
          "expiration": 86400,
          "content": "<img src=\"http://go.sonobi.com/images/logo_300x250.jpg\"\\>"
        }
        //...
      ]
    },
    {
      "tid": 2,
      "ads": [
        {
          "categories": ["6", "10"],
          "content": "<img src=\"http://go.sonobi.com/images/logo_300x250.jpg\"\\>"
        }
        //...
      ]
    }
    //...
  ]
}