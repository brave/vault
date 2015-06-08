# Brave Vault - a Personal Data Store for holding high-value user behavior with high privacy.

Design notes, very rough. Not a README yet!

Brave will log intent signals to be stored in the Vault. What's an intent signal? Lots of user actions:

* Page navigation.
* App state change.
* Scrolling content into and out of view.
* Idle time based on all input devices.
* Bookmarking, this page or this link or this group (tabs or links).
* Opening a link in a new tab (see LinkBubble Android browser).
* Form data including passwords.

We may not know how to condense or abstract this log into a user model for better high-privacy ads and other economic actions, in advance. We may need to do machine learning (and human learning among ourselves) to get the right reductions in place. And the "right reductions" will change over time.

Therefore one idea is to log everything, compressed and in the brackground, and dump it into big log files in S3 buckets. Use AWS spot instances since we don't care about latency. Worry about reliability (TODO, lol).

Then the Vault becomes a personal data mine. The challenge at lowest level is to process log files. See https://github.com/mozilla-services/heka for one way to do this.

/be
