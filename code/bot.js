var Twitter = require('twitter');
var request = require('request');
const fs = require('fs');
var schedule = require('node-schedule');

//Schedules rules for tweets & tweets database
var rule = new schedule.RecurrenceRule();
var updateRule = new schedule.RecurrenceRule();

//Twitter client
var client = new Twitter({
  consumer_key: process.env.consumer_key,
  consumer_secret: process.env.consumer_secret,
  access_token_key: process.env.token_key,
  access_token_secret: process.env.token_secret,
});

//Init
var tweetsUrl = 'https://raw.githubusercontent.com/RandomAdversary/AI-Security-Bot/master/content/tweets.json';
var tweets = [];
var selected = -1;
var tweeted = [];
//Downloads tweets datatabse.
updateTweets();
//Get the ids for previous tweets.
if(fs.existsSync('tweeted.json')){
  loadTweeted();
}

//Scheduler setup
//Controlls how often should tweet be made.
//Example: rule.minute = 42 means every hour at 42 minutes after the hour,
//attempt to tweet will be made.
rule.minute = new Date().getMinutes() +1;
tweetScheduler = schedule.scheduleJob(rule,selectTweet);
//At 07:07 AM the tweets database is updated.
updateRule.hour = 7;
updateRule.minute = 7;
schedule.scheduleJob(updateRule,updateTweets);

//Introduce little randomness into the bot
function updateTweetRule(){
  rule.minute = [Math.floor(Math.random() * 59)];
  tweetScheduler.reschedule(rule);
  console.log("[Info][" + new Date() + "] Tweet rule updated. New rule is " + rule.minute + ".");
}

//Download fresh copy of the tweets.json file
function updateTweets() {
  request.get(tweetsUrl, function (err, res, body) {
    if (!err && res.statusCode == 200) {
      tweets = JSON.parse(body);
      console.log("[Info][" + new Date() + "] Tweets have been updated.");
    } else {
      console.log("[Error][" + new Date() + "] Unable to update tweets!", err);
    }
  });
}

//Tweet!
function tweet(status) {
  client.post('statuses/update', status, function (error, tweet, response) {
    if (error) {
      console.log("[Error][" + new Date() + "] Tweet error!", error);
      return;
    }
    console.log("[Info][" + new Date() + "] Tweet!");
    updateTweetRule();
    tweeted.push(tweets[selected].id);
    saveTweeted();
  });
}

//Upload image for upcoming tweet
function prepareTweetImage(tweetID) {
  //TODO - Rewrite this to avoid disk usage
  var stream = request(tweets[tweetID].image).pipe(fs.createWriteStream('/tmp/img.png'));
  stream.on('finish', function () {
    var image = fs.readFileSync('/tmp/img.png', {encoding: 'base64'});
    client.post('media/upload', {media_data: image}, function (err, data, res) {
      if (err) {
        console.log("[Error][" + new Date() + "] Unable to upload media!", err);
      } else {
        tweet({status: tweets[tweetID].tweet,media_ids: data.media_id_string });
      }
    })
  })
}

//Decide what to tweet
function selectTweet() {
  console.log("[Info][" + new Date() + "] Selecting tweet...");
  selected = Math.floor(Math.random() * tweets.length);
  console.log("[Info] Selected ID " + selected);
  if(tweeted.includes(tweets[selected].id)){
    console.log("[Info] Tweet has been already tweeted.");
    return;
  }
  if (tweets[selected].image.trim().length === 0) {
    tweet({status: tweets[selected].tweet});
  } else {
    prepareTweetImage(selected);
  }
}

//Save the id of previously tweeted posts.
function saveTweeted(){
  //TODO - Sync with git
  fs.writeFile("/mnt/tweeted.json", JSON.stringify(tweeted), function(err){
    if(err){
      console.log("[Error][" + new Date() + "] Unable to save list of previously tweeted posts(tweeted.json).", err);
    } else {
      console.log("[Info][" + new Date() + "] tweeted.json has been updated.");
    }
  });
}

//Load the json with previously tweeted ids.
function loadTweeted(){
  //TODO - Sync with git
  tweeted = JSON.parse(fs.readFileSync("/mnt/tweeted.json"));
}
