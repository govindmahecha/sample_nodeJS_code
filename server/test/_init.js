/*
 * File we've designated to contain root-level hooks.
 *
 * Filename doesn't matter; Mocha will detect the root-level methods
 * in any test file and execute as expected
 *
 * http://visionmedia.github.com/mocha/, search for '“root” level hooks'
 */

const dotenv = require('dotenv');
const path = require('path');
dotenv.load({ path: path.join(__dirname, './../../.env') });
const exec = require('child_process').exec;
const mongoose = require('mongoose');



const Ask = require('../models/Ask');
const Community = require('../models/Community');
const CommunityJoinLog = require('../models/CommunityJoinLog');
const Match = require('../models/Match');
const Reply = require('../models/Reply');
const Notification = require('../models/Notification');
const Offer = require('../models/Offer');
const Tag = require('../models/Tag');
const User = require('../models/User');

/*
 * before Method
 *
 * The before method will execute every time Mocha is run. This
 * code will not run every time an individual test is run.
 */
 before(async () =>{
    // Connecting to a local test database or creating it on the fly
    // exec('db_init test clear', 
    //   function (error, stdout, stderr){
    //     // if (error) { console.log(error); return done(new Error(error));}
    //     // if (stderr) { console.log(stderr); return done(new Error(stderr));}
    //     return done();
    //   }
    // );
    const mongooseConnection = await mongoose.connect(
      process.env.MONGODB_TEST_URI,
      {
        connectTimeoutMS: 3000,
        useNewUrlParser: true,
      });
    
    try {
      await Promise.all([
        Ask.collection.drop(),
        Community.collection.drop(),
        CommunityJoinLog.collection.drop(),
        Offer.collection.drop(),
        Match.collection.drop(),
        Reply.collection.drop(),
        Notification.collection.drop(),
        Tag.collection.drop(),
        User.collection.drop(),
      ]).catch(e => {
        // Dropping non-existent collections throws an error. We don't care about those.
      });
    } catch(e) {}
    
  

    const community = await Community.create({
      _id : '5b45ae82d3ccafbec917de1b',
      name : 'GSB 2018'
    });
    
    const amit = await User.create({
      email : 'amit101@alumni.gsb.stanford.edu',
      password: 'msx18admin',
      isEmailVerified : true,
      profile : {
        name : 'Amit Kumar',
        emails : [{
          email : 'amit101@alumni.gsb.stanford.edu'
        }]
      },
      isAdmin : true,
      communities : [ community ]
    });

    community.admins.push(amit._id);
    await community.save();

    const seed = require('./../db/test-seed-data');
    for (var user of seed){
      var userModel = new User({
        email : user['Email Address'],
        password : 'msx18',
        profile : {
          name : user['Name'],
          linkedInUrl : user["LinkedIn Profile (so we have everyone's in one place)"],
          emails : [{
            email : user['Email Address']
          }],
          postGraduationPlans : user["What are your general career plans post-graduation? (If you have no clear plans, don't panic! Share what areas you're exploring instead.)"]
        },
        communities : [ community ]
      });
      
      await userModel.save();

      var ask1Prompt = 'Are there any sectors/companies/people are you currently looking to be connected to?';    
      if (user[ask1Prompt]){
        let ask = new Ask({
          owner : userModel,
          body : user[ask1Prompt],
          tags : user['ASK: Sector'].split(',').map((tag) => { return tag.trim()}).filter(tag => !!tag)
        });
        await ask.save();
      }

      var offer1Prompt = 'What sectors/companies can you help connect classmates to?';
      if (user[offer1Prompt]){
        let offer = new Offer({
          owner : userModel,
          body : user[offer1Prompt],
          tags : user['OFFER: Sector'].split(',').map((tag) => { return tag.trim()}).filter(tag => !!tag)
        });
        await offer.save();
      }
    }

    await Ask.ensureIndexes();
    await Offer.ensureIndexes();

    return;
  }
);

/*
 * after Method
 *
 * Just like the before, after is run after Mocha has completed
 * running its queue.
 */
 after(function(done){
  // mongooseConnection.close();
  done();
 });
