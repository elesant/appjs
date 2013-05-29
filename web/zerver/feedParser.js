var redis = require('redis-url')
        //.connect(process.env.REDISTOGO_URL)
        .connect('redis://localhost:6379')
        .on('error', function () {});

var currentArticles;
var test;

function init () {
  var fp       = require('feedparser'),
      Promise  = require('rsvp').Promise,
      promise  = new Promise(),
      articles = [],
      index    = 0;

  function add (article) {
    // Make an Article object, add it to an array
    var obj     = {};
    obj.index   = index;
    obj.timestamp = +new Date(); //Adding a timestamp to each article
    obj.title   = article['title'];
    obj.content = article['description'];
    obj.link    = article['link'];
    obj.description = article['summary'];

    //This should remove certain tags from the HTML (ie. perez.videoplayer)
    obj.content = obj.content.replace(/\<p[^>]*\>\<object[^>]*\>[^<]*\<\/object\>\<\/p\>/g, '');
    obj.content = obj.content.replace(/\<script[^>]*\>[^<]*\<\/script\>/g, '');
    obj.content = obj.content.replace(/\<iframe[^>]*\>[^<]*\<\/iframe\>/g, '');

    //Add a new article to the stack and increment topArticle pointer and index
    articles.push(obj);
    index++;

    if(articles.length === 10 ){
      promise.resolve(articles);
    }
  }

  fp.parseUrl('http://i.perezhilton.com/?feed=atom').on('article', add);

  return promise;
}

function updateArticles () {
  console.log('Updating Articles...');
  init().then(function(articles) {
    test = articles;
    console.log('Articles Updated');

    //Creates an array for all article links stored in currentArticles
    var articleLinks = [];
      currentArticles.forEach(function (article) {
      articleLinks.push(article.link);
    });

    //Checks for duplicates and removes them
    var currentLink;
    articles.forEach(function (article) {
      currentLink = article.link;

      for(var i=1; i<articleLinks.length; i++){
        if (currentLink === articleLinks[i]){
          //remove this entry from currentArticles
          currentArticles.splice(i, 1);
          break;
        }
      }
    });

    //Combines the articles and currentArticles array
    currentArticles = articles.concat(currentArticles);

    //console.log(currentArticles.length);

    redis.set('articles', JSON.stringify(currentArticles));
  });
}

function startArticleUpdating () {  
  redis.get('articles', function (err, jsonArticles) {
    if (!err && jsonArticles) {
      var articles;
      try {
        articles = JSON.parse(jsonArticles);
      }
      catch (err) {}
      if (typeof articles === 'object') {
        currentArticles = articles;
      }
    }
    // Fetch new articles every 15 mins
    //setInterval(updateArticles, 1 * 10 * 1000);

    setInterval(updateArticles, 1 * 10 * 1000);
    updateArticles();
  });
}

startArticleUpdating();

exports.getArticles = function (timestamp, callback) {
  if (typeof timestamp === 'function') {
    callback  = timestamp;
    timestamp = null;
  }

  //If no currentArticles should get all new articles
  if ( !currentArticles ) {
    currentArticles = test;
    return;
  }

  //If articles without a timestamp, currentArticles will contain all new articles
  if ( !timestamp ) {
    callback(currentArticles);
    console.log('!timestamp, same currentArticles');
    return;
  }

  //If articles with timestamps older than the current one, 
  var newArticles = [];
  currentArticles.forEach(function (article) {
    if (article.timestamp > timestamp) {
      newArticles.push(article);
      console.log('!Push articles with > timestamp');
    }
  });

  callback(newArticles);
};