var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');
var bcrypt = require('bcrypt-nodejs');
var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));


app.get('/',
function(req, res) {
  res.render('index');
});

app.get('/create', isLoggedIn,
function(req, res) {
  res.render('index');
});

app.get('/links', isLoggedIn,
function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.post('/links',isLoggedIn,
  function(req, res) {
    var uri = req.body.url;
    console.log("URI: " + uri);
    if (!util.isValidUrl(uri)) {
      console.log('Not a valid url: ', uri);
      return res.send(404);
    }

    new Link({ url: uri }).fetch().then(function(found) {
    console.log("Creating a new link: ", uri);
    if (found) {

        console.log("FOUND", JSON.stringify(found));
      res.send(200, found.attributes);
    } else {

        console.log("Step 0");
      util.getUrlTitle(uri, function(err, title) {
        console.log("Step 1");
        if (err) {
          console.log("Step 2");
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }
        console.log("Step 3");
        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });
        console.log("Step 4");

        link.save().then(function(newLink) {
          console.log("Step 5");
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

app.post('/login',
  passport.authenticate('local', { successRedirect: '/',
                                   failureRedirect: '/login',
                                   failureFlash: true}));

app.get('/login',
function(req, res) {
  res.render('login');
});

app.get('/signup',
  function(req, res){
    res.render('signup');
  });

app.post('/signup', function(req, res){

  new User({ username: req.body.username }).fetch().then(function(found) {
    if (found) {
      //alert select diff user name
      res.send(200, found.attributes);
    } else {
      console.log("CREATING NEW USER");
      generateHash(req.body.password, function(hashedWord, salt){
        var user = new User({
          username: req.body.username,
          password: hashedWord,
          salt: salt
        });
        user.save().then(function(newUser) {
          console.log("New User is: ", newUser);
          Users.add(newUser);
          res.render('index');
        });
      })
    }
  });
});

function generateHash(password, callback) {
  bcrypt.genSalt(10, function(err, salt){
    if(err) {
      throw err;
    }
    console.log("Inside hashing function", salt);
    bcrypt.hash(password, salt, null, function(err, result){
      if(err) {
        throw err;
      }
      console.log("Inside the second callback in hashig", result);
      callback(result, salt);
    })
  })
}

function isLoggedIn(req, res, next) {

  // if user is authenticated in the session, carry on
  if (req.isAuthenticated())
    return next();

  // if they aren't redirect them to the home page
  res.redirect('/');
}
/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
