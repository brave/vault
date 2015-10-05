var assert = require('assert');
var request = require('request');
var PriorityQueue = require('priorityqueuejs');

// TODO - add IAB size names
const BOX    = {"tsize": "300x250"};
const BANNER = {"tsize": "728x90"};

// request a set of ads from Sonobi with an Intent keyword
var request_ads = function(db, intent, done) {

  // TODO - this should be dynamically built
  var params = {
    "elements": {
	"content_types": ["image/gif","image/png","image/jpeg"],
	"tiles": [
		   [BOX, BOX, BOX],
		   [BANNER, BANNER, BANNER]
		 ]
    },
    "cat": {
	"2": "1 hour",
	"17": "5 days",
	"20": "30 days"
    },
    "lir": {
	"ip": 0,
	"intent": 1,
	"loc": 1,
	"uid": 0
    }
  };

  // TODO - url should come from config
  var options = {
    "method": "POST",
    "url": "http://brave-development.go.sonobi.com/oip.json",
    "headers": {
	'Content-Type': 'application/json'
    },
    "body": JSON.stringify(params)
  };

  request(options,
	function(err, response, data) {
	      // TODO - post process ads
	      var ads_col = db.get('ads');
	    
	      done(err, data);
	});
    
};

/*
  The Sonobi object communicates with the Sonobi
  web service to retrieve, cache and expire
  ad units as they are served.
 */
class Sonobi {
    constructor(config, db) {
	this.config = config;
	this.db     = db;

	// TODO - move this to some place more general
	var date_comparator = function(a, b) {
	    return a.datetime - b.datetime;
	};

	// Different queue for each creative size
	this.pq = {
	    "BOX": new PriorityQueue(date_comparator),
	    "BANNER": new PriorityQueue(date_comparator)
	};

	this.size_to_queue = {
	    "728x90": this.pq.BANNER,
	    "300x250": this.pq.BOX
	};

    }

    prefill() {
	var that = this;
	// this needs to come from some other source
	var intent = 'BMWs';

	// request Sonobi ads to fill cache
	request_ads(this.db,
		    intent,
		    function(err, results) {
			assert.equal(null, err);

			var ads = JSON.parse(results);
			// TODO - check valid JSON response

			// The first set of ads are for the 300x250 size
			// we check for the ad.url key as some ad units
			// are returned without info.
			ads.elements.tiles[0].forEach(function(ad) {
				if (ad.url) {
				    ad.datetime = new Date();
				    console.log(ad);
				    that.pq.BOX.enq(ad);
				}
			});

			// The first set of ads are for the 728x90 size
			// we check for the ad.url key as some ad units
			// are returned without info.
			ads.elements.tiles[1].forEach(function(ad) {
				if (ad.url) {
				    ad.datetime = new Date();
				    console.log(ad);
				    that.pq.BANNER.enq(ad);
				}
			});

	         });
    }

    ad_unit_for_intent(intent, width, height) {
	// TODO - here we need to look at the intent
	var pq = this.size_to_queue[width + 'x' + height];
	// TODO - ensure the request has a valid width and height
	try {
	    return pq.deq();
	} catch (err) {
	    // no ads left in the queue
	    console.log("no ads available");
	    return null;
	}
    }
}

exports.Sonobi = Sonobi;
