#! /usr/bin/env node
var args = process.argv.slice(2);

const async = require('async');
const dotenv = require('dotenv');
const mongoose   = require('mongoose');
const Ask = require('../models/Ask');
const Community = require('../models/Community');
const Reply = require('../models/Reply');
const Offer = require('../models/Offer');
const Tag = require('../models/Tag');
const Match = require('../models/Match');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Chat = require('../models/Chat');
const CommunityJoinLog = require('../models/CommunityJoinLog');
const Enums = require('../../common/enums');
const moment = require('moment-timezone');
const ObjectId = mongoose.Types.ObjectId;

dotenv.load({ path: '../../.env' });

async function addAdmin(){
  var gsbCommunity = await Community.findOne({
    _id : '5b45ae82d3ccafbec917de1b'
  });

  var amit = await User.findOne({
    email : 'amit101@alumni.gsb.stanford.edu',
  });

  gsbCommunity.admins.push(amit);
  await gsbCommunity.save();
  console.log(gsbCommunity);
  return gsbCommunity;
};

async function blockUser(){
  const community = await Community.findOne({
    name : 'GSB Accelerate'
  });

  const admin = await User.findOne({
    email : 'amit101@alumni.gsb.stanford.edu',
  });

  const user = await User.findOne({
    email : 'cpsatya@example.com',
  });

  if (!user.communities.some(communityId => communityId.equals(community._id))) {
    user.communities.push(community);
    await user.save();
  }
  
  const joinLog = await CommunityJoinLog.create({
    owner : user,
    targetUser : user,
    action: 'join',
    community : community
  });
  

  const result = await community.blockUser(admin, user)
  console.log(result);
  return result;
};

async function getAskMatches(){
  const offerTags = await Offer.aggregate([
    { $project: { _id: 0, tags: 1 } },
    { $unwind: '$tags' },
    { $group: { _id: '$tags', count: { $sum: 1 } } },
    { $project: { _id: 1, tag: '$_tags', count: 1 } },
  ]); 
  

  const sortedOfferTags = offerTags.sort((a, b) => {
    if (a.count > b.count) {
      return -1;
    } else if (a.count < b.count) {
      return 1;
    } else {
      return 0;
    }
  });

  let targetTag = sortedOfferTags[0];
  console.log('targetTag', targetTag);

  const user = await User.findOne({
    email : 'amit101@alumni.gsb.stanford.edu'
  });
  const ask = await Ask.create({
    owner : user,
    visibility : 'specific-communities',
    communities : [user.defaultCommunity],
    tags : [targetTag._id],
    body : "I'm looking for help with fundraising and conducting user interviews.",
    lookingFor : 'advice',
    desiredResponseType : 'quick-reply'
  });

  console.log('ask', {
    _id : ask._id,
    tags : ask.tags,
    body : ask.body,
    lookingFor : ask.lookingFor,
    desiredResponseType : ask.desiredResponseType
  });
  const askMatches = await ask.getMatchedOffers();

  console.log('askMatches.tagMatches', askMatches.tagMatches.length);
  console.log('askMatches.textMatches', askMatches.textMatches.length, askMatches.textMatches);

  // Cleanup
  await ask.remove();
}

async function refreshTagCollection(){
  let asks = (await Ask.find());
  let askResults = await Promise.all(
    asks.map(async (ask) => {
      ask.markModified('tags');
      return await ask.save();
    })
  );
  let offers = (await Offer.find());
  let offerResults = await Promise.all(
    offers.map(async (offer) => {
      offer.markModified('tags');
      return await offer.save();
    })
  );
  let tags = await Tag.find();
  console.log('tags', tags);
}

async function sendEmailVerification(){
  const amit = await User.findOne({
    email : 'amit101@alumni.gsb.stanford.edu',
  });
  var result = await amit.sendEmailVerification('https', 'reciprocity.community');
  console.log('result', result);
}

async function getCommunityAskTags(){
  const groupedTags = await Ask.aggregate([
    {
      $match: {
        communities: { $in : [mongoose.Types.ObjectId('5be7e3448a51730dc002872e')] }
      }
    },
    { $project: { _id: 0, tags: 1 } },
    { $unwind: '$tags' },
    { $group: { _id: '$tags', count: { $sum: 1 } } },
    { $project: { _id: 1, tag: '$_tags', count: 1 } },
  ]);

  const tags = groupedTags.sort((a, b) => {
    if (a.count > b.count) {
      return -1;
    } else if (a.count < b.count) {
      return 1;
    } else {
      return 0;
    }
  });
  
  return tags.map(g => {
    return { tag: g._id, count: g.count };
  });
}

async function createNewCommunity(props){
  const amit = await User.findOne({
    email : 'amit101@alumni.gsb.stanford.edu'
  });
  // const lynds = await User.findOne({
  //   email : 'lyndseyb@alumni.gsb.stanford.edu'
  // });

  const comm = await Community.create({
    ...props,
    admins : [amit._id]
  });
  
  amit.communities.push(comm);
  // amit.defaultCommunity = comm;
  await amit.save();
  // lynds.communities.push(comm);
  // lynds.defaultCommunity = comm;
  // await lynds.save();
}

async function refreshAskMatches(){
  let asks = (await Ask.find());
  let matches = await Promise.all(
    asks.map(async (ask) => {
      return await ask.upsertMatchedOffers();
    })
  );
  console.log('refreshAskMatches', matches);
  return matches;
}
  
async function refreshOfferMatches(){
  let offers = (await Offer.find());
  let matches = await Promise.all(
    offers.map(async (offer) => {
      return await offer.upsertMatchedAsks();
    })
  );
  console.log('refreshOfferMatches', matches);
  return matches;
}

async function refreshUserBio(){
  let users = (await User.find());
  await Promise.all(
    users.map(async (user) => {
      try{
        let linkedInProfile = (user.linkedInProfile && user.linkedInProfile._json && user.linkedInProfile._json.summary) ? user.linkedInProfile._json.summary : null;
        let linkedInUrl = (user.linkedInProfile && user.linkedInProfile._json && user.linkedInProfile._json.publicProfileUrl) ? user.linkedInProfile._json.publicProfileUrl : null;
        user.profile.linkedInUrl = user.profile.linkedInUrl || linkedInUrl;
        user.profile.bio = user.profile.bio || linkedInProfile;
        return await user.save();  
      } catch (e){
        console.log(e);
      }
    })
  );
  return users;
}

async function clearUserBio(){
  let users = (await User.find());
  await Promise.all(
    users.map(async (user) => {
      try{
        user.profile.bio = null;
        return await user.save();  
      } catch (e){
        console.log(e);
      }
    })
  );
  return users;
}


async function sendPendingNotifications(){
  let notifications = await Notification.find(
  {
    currentStatus : { $in : [
      Enums.notificationType.ASK_REPLY_ADDED,
      Enums.notificationType.OFFER_REPLY_ADDED,
      Enums.notificationType.CHAT_RECEIVED,
    ]},
    emailSentAt : { $exists : false }
  });
  await Promise.all(
    notifications.map(async (notification) => {
      try{
        // console.log('sending email for notification', notification);
        await notification.sendEmail();
      } catch (e){
        console.log(e);
      }
    })
  );
  return notifications;
}

async function fixReplyNotifications(){
  let notifications = await Notification.find(
  {
    currentStatus : { $in : [
      Enums.notificationType.ASK_REPLY_ADDED,
      Enums.notificationType.OFFER_REPLY_ADDED
    ]},
    reply : { $exists : false }
  });

  const allReplies = await Reply.find({
    'replyTo.value' : { $in : notifications.map(notification => (notification.ask || notification.offer)) }
  });
  let repliesByReplyTo = {};
  allReplies.forEach(r => {
    repliesByReplyTo[r.replyTo.value] = repliesByReplyTo[r.replyTo.value] || [];
    repliesByReplyTo[r.replyTo.value].push(r);
  });

  await Promise.all(
    notifications.map(async (notification) => {
      try{
        notification.reply = repliesByReplyTo[notification.ask || notification.offer].shift()
        return await notification.save();
      } catch (e){
        console.log(e);
      }
    })
  );
  return notifications;
}

async function clearBrokenNotifications(){
  let notifications = await Notification.deleteMany(
  {
    communities : { $size: 0 }
  })
  // .populate('owner')
  // .populate('ask')
  // .populate('offer')
  // .populate('chat')
  // .populate('reply');
  console.log(notifications);
  return notifications
}

async function fixNotificationCommunities(){
  let notifications = await Notification.find(
  {
    communities : { $size: 0 }
  })
  .populate('owner')
  .populate('ask')
  .populate('offer')
  .populate({
    path : 'chat',
    populate : [
      {
        path : 'from',
      },
      {
        path : 'to',
        populate : {
          path : 'communities',
          select : 'slug'
        }
      }
    ]
  })
  .populate({
    path : 'communities',
    select : 'slug'
  })
  .populate({
    path : 'reply',
    populate : { 
      path : 'owner',
      select : 'profile'
    }
  });

  await Promise.all(
    notifications.map(async (notification) => {
      try{
        
        let communities = [];
        if (notification.ask){
          communities = notification.ask.communities;
        }
        if (notification.offer){
          communities = notification.offer.communities;
        }
        if (notification.reply){
          communities = notification.reply.communities;
        }
        if (notification.chat){
          communities = notification.chat.communities;
        }
        
        notification.communities = communities;
        console.log('updating notification', notification);
        return await notification.save();
      } catch (e){
        console.log(e);
      }
    })
  );
  return notifications;
}

async function fixUserNames(){
  let users = await User.find(
  {
    'profile.firstName' : null
  });
  await Promise.all(
    users.map(async (user) => {
      try{
        const nameParts = user.profile.name ? user.profile.name.split(' ') : [];
        console.log('nameParts', nameParts);
        user.profile.firstName = user.profile.firstName || nameParts[0];
        user.profile.lastName = user.profile.lastName || nameParts[1];
        return await user.save();
      } catch(e){
        console.log(e);
      }
    })
  );
  console.log(users);
  return users;
}

async function enforceMatchThreshold(){
  const matches = await Match.find({ 'textMatchScore' : { $lt : 5 } });
  console.log('matches', matches.length);
  await Promise.all(
    matches.map(async (m) => {
      await m.remove();
    })
  );
}

async function getStats(){
  const accelerateId = ObjectId('5be7f9fb765dd919cbf2b349');
  const accelerate = await Community.findOne({_id : accelerateId });

  const signups = await User.find({
    isAdmin : false,
    communities : { $in : [accelerateId] },
    createdAt : { 
      $gte : moment.tz("2019-02-09 08:00", "America/Los_Angeles").toDate()
    }
  }).countDocuments();
  console.log(`User signups since 2/9/2019 : ${signups}`);

  const asks = await Ask.find({
    communities : { $in : [accelerateId] },
    createdAt : { 
      $gte : moment.tz("2019-02-09 08:00", "America/Los_Angeles").toDate()
    }
  }).countDocuments();
  console.log(`Asks since 2/9/2019 : ${asks}`);

  const offers = await Offer.find({
    communities : { $in : [accelerateId] },
    createdAt : { 
      $gte : moment.tz("2019-02-09 08:00", "America/Los_Angeles").toDate()
    }
  }).countDocuments();
  console.log(`Offers since 2/9/2019 : ${offers}`);

  const replies = await Reply.find({
    communities : { $in : [accelerateId] },
    createdAt : { 
      $gte : moment.tz("2019-02-09 08:00", "America/Los_Angeles").toDate()
    }
  }).countDocuments();
  console.log(`Replies since 2/9/2019 : ${replies}`);

  const oldUsers = await User.find({
    isAdmin : false,
    communities : { $in : [accelerateId] },
    createdAt : { 
      $lte : moment.tz("2019-02-09 08:00", "America/Los_Angeles").toDate()
    }
  })
  .populate('asks')
  .populate('offers')
  .populate('replies')
  .populate('askUpvotes')
  .populate('offerUpvotes')
  .populate('replyUpvotes')

  const users = await User.find({
    isAdmin : false,
    communities : { $in : [accelerateId] }
  })
  .populate('asks')
  .populate('offers')
  .populate('replies')
  .populate('askUpvotes')
  .populate('offerUpvotes')
  .populate('replyUpvotes')

  const usersWithPoints = users.map(u => {
    let points = 0;
    points += u.asks.length;
    points += u.offers.length;
    points +=  u.replies.length;
    points +=  u.askUpvotes.length;
    points +=  u.offerUpvotes.length;
    points +=  u.replyUpvotes.length;

    return {
      name : u.profile.name,
      email : u.email,
      asks : u.asks.length,
      offers : u.offers.length,
      replies : u.replies.length,
      askUpvotes : u.askUpvotes.length,
      offerUpvotes : u.offerUpvotes.length,
      replyUpvotes : u.replyUpvotes.length,
      totalPoints : points
    }
  }).sort((a, b) => {
    if (a.totalPoints > b.totalPoints){
      return -1;
    } else if (a.totalPoints < b.totalPoints){
      return 1;
    }
    return 0;
  });

  console.log('usersWithPoints', usersWithPoints)
}

(async function(){
  console.log('process.env.MONGODB_URI', process.env.MONGODB_URI);
  mongoose.connect(process.env.MONGODB_URI, {
    "keepAlive" : true,
    "connectTimeoutMS" : 30000,
    "useNewUrlParser" : true
  });
  mongoose.connection.on('error', (err) => {
    console.error(err);
    console.log('%s MongoDB connection error. Please make sure MongoDB is running.');
    process.exit();
  });

  // await addAdmin();
  // await blockUser();
  // await getAskMatches();
  // await refreshTagCollection();
  // await sendEmailVerification();
  // await createNewCommunity({
  //   name : 'Serendipity',
  //   prefs : {
  //     backgroundImage : 'serendipity/chris-knight-458508-unsplash.jpg'
  //   }
  // });
  // await getCommunityAskTags();
  // await refreshAskMatches();
  // await refreshOfferMatches();
  // console.log(await refreshUserBio());
  // console.log(await clearUserBio());
  // console.log(await fixPendingNotifications());
  // console.log('fixNotificationCommunities', await fixNotificationCommunities());
  // console.log('clearBrokenNotifications', await clearBrokenNotifications())
  // await sendPendingNotifications();
  // await fixUserNames();
  // await enforceMatchThreshold();

  await getStats();

  process.exit();
})().catch(err => console.error(err.stack));