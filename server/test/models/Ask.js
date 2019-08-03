const mongoose = require('mongoose'),
  Ask = require('../../models/Ask'),
  Offer = require('../../models/Offer'),
  Reply = require('../../models/Reply'),
  Notification = require('../../models/Notification'),
  Tag = require('../../models/Tag'),
  User = require('../../models/User'),
  Community = require('../../models/Community'),
  Match = require('../../models/Match'),
  should = require('should');

const {expect} = require('chai')

describe('Ask', () => {

  describe('create', () => {
    it('should normalize tags, remove duplicate tags, and upsert new tags into Tags collection', async () => {
      const user = await User.findOne({
        email : 'amit101@alumni.gsb.stanford.edu'
      });


      const newTag = 'New  Tag',
          normalizedNewTag = Tag.normalize(newTag),
          newTagKey = Tag.getKey(newTag);

      const ask = await Ask.create({
        owner : user,
        visibility : 'specific-communities',
        communities : [user.defaultCommunity],
        tags : ['aerospace', ' Aerospace', newTag],
        body : "I'm looking for help with fundraising and conducting user interviews.",
        lookingFor : 'advice',
        desiredResponseType : 'quick-reply'
      });

      // Created Ask should have 2 entries in .tags : 'Aerospace' and 'New Tag'
      // Tags collection should now have 'New Tag'
      expect(ask.tags.length).to.equal(2);
      expect(ask.tags).to.include('aerospace');
      expect(ask.tags).to.include(newTagKey);

      const tagDoc = await Tag.findOne({ key : newTagKey});

      expect(tagDoc).to.exist;
      expect(tagDoc.key).to.equal(newTagKey);
      expect(tagDoc.display).to.equal(normalizedNewTag);

      // Cleanup
      await Ask.deleteOne({_id: ask.id}).exec();
      return;
    })
  });


  describe('.getMatchedOffers', () => {
    it('should match all tag and text matches from Offers', async () => {
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

      const user = await User.findOne({
        email : 'amit101@alumni.gsb.stanford.edu'
        // email  : 'mcroce@example.com'
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

      const askMatches = await ask.getMatchedOffers();

      expect(askMatches.tagMatches.length).to.equal(targetTag.count);
      expect(askMatches.textMatches.length).to.be.at.least(targetTag.count);

      console.log('TODO : Verify that no matches were made that are not in shared communities');
      await ask.upsertMatchedOffers();

      // Cleanup
      await Ask.deleteOne({_id: ask.id}).exec();
      return;
    });
  });

  describe('editing .body', () => {
    it('should re-run match algorithm', async () => {
      // Creating two offers with completely different bodies
      // And other documents that needed to create matches
      const [userOffering, userAsking, community] = await Promise.all([
        User.findOne({
          email : 'amit101@alumni.gsb.stanford.edu'
        }),
        User.create({
          email : 'temp7777xxx@example.com'
        }),
        Community.create({
          name :  'Test community 777a7a'
        })
      ]);
      const [offer1, offer2, ask] = await Promise.all([
        Offer.create({
          owner : userOffering,
          visibility : 'specific-communities',
          communities : community,
          body : 'I can help me with learning node.js'
        }),
        Offer.create({
          owner : userOffering,
          visibility : 'specific-communities',
          communities : community,
          body: 'I can teach php'
        }),
        Ask.create({
          owner : userAsking,
          visibility : 'specific-communities',
          communities : community,
          body : 'Heyyyy, I would like to find someone to learn js together!'
        })
      ]);
      await ask.upsertMatchedOffers();

      const [matchesWithOffer1, matchesWithOffer2] = await Promise.all([
        Match.find({
          ask: ask._id,
          offer: offer1._id
        }),
        Match.find({
          ask: ask._id,
          offer: offer2._id
        })
      ]);
      expect(matchesWithOffer1.length).to.be.at.least(1);
      expect(matchesWithOffer2.length).to.equal(0);
      ask.body = 'I seek for a php tutor';
      await ask.save();

      // Some delay to let ask middleware to finish post-working
      matches = await Match.find({ask:ask._id});

      const [updMatchesWithOffer1, updMatchesWithOffer2] = await Promise.all([
        Match.find({
          ask: ask._id,
          offer: offer1._id
        }),
        Match.find({
          ask: ask._id,
          offer: offer2._id
        })
      ]);

      expect(updMatchesWithOffer1.length).to.equal(0);
      expect(updMatchesWithOffer2.length).to.be.at.least(1);

      await Promise.all([
        Ask.deleteOne({_id: ask.id}).exec(),
        User.deleteOne({_id: userAsking.id}).exec(),
        Community.deleteOne({_id: community.id}).exec(),
        Offer.deleteMany({communities: community.id}).exec()
      ]);
      return;
    });
  });

  describe('remove', () => {
    it('should remove all Replies referencing this, and all Notifications referencing those Replies', async () => {
      // Create asks to test out all types of deleting middleware
      const user = await User.findOne({
        email : 'amit101@alumni.gsb.stanford.edu'
      });
      const askSettings = {
        owner : user
      };
      const [ask, askForDeleteOne, askForDeleteOneByBody,
        askForDeleteMany1, askForDeleteMany2] = await Promise.all([
          Ask.create(askSettings),
          Ask.create(askSettings),
          Ask.create({
            owner : user,
            body: 'testaskfordeleteonebybody'
          }),
          Ask.create({
            owner : user,
            body: 'testaskfordeletemany'
          }),
          Ask.create({
            owner : user,
            body: 'testaskfordeletemany'
          })
      ]);

      // Create replies
      const replySettings = {
        owner: user,
        body : 'test',
        replyTo: {
          refToModel: 'Ask',
          value: ask.id
        }
      };
      const replySettingsForDeleteOne = {
        owner: user,
        body : 'test2',
        replyTo: {
          refToModel: 'Ask',
          value: askForDeleteOne.id
        }
      };
      const replySettingsForDeleteOneByBody = {
        owner: user,
        body : 'test3',
        replyTo: {
          refToModel: 'Ask',
          value: askForDeleteOneByBody.id
        }
      };
      const replySettingsForDeleteMany1 = {
        owner: user,
        body : 'test4',
        replyTo: {
          refToModel: 'Ask',
          value: askForDeleteMany1.id
        }
      };
      const replySettingsForDeleteMany2 = {
        owner: user,
        body : 'test5',
        replyTo: {
          refToModel: 'Ask',
          value: askForDeleteMany2.id
        }
      };
      const replies = await Promise.all([
        Reply.create(replySettings),
        Reply.create(replySettings),
        Reply.create(replySettingsForDeleteOne),
        Reply.create(replySettingsForDeleteOne),
        Reply.create(replySettingsForDeleteOneByBody),
        Reply.create(replySettingsForDeleteOneByBody),
        Reply.create(replySettingsForDeleteMany1),
        Reply.create(replySettingsForDeleteMany1),
        Reply.create(replySettingsForDeleteMany2),
        Reply.create(replySettingsForDeleteMany2)
      ]);

      // Create notifications
      const notificationSettings = {
        reply : replies[0]
      };
      const notificationSettingsForDeleteOne = {
        reply : replies[2]
      };
      const notificationSettingsForDeleteOneByBody = {
        reply: replies[4]
      };
      const notificationSettingsForDeleteMany1 = {
        reply : replies[6]
      };
      const notificationSettingsForDeleteMany2 = {
        reply : replies[8]
      };
      await Promise.all([
        Notification.create(notificationSettings),
        Notification.create(notificationSettings),
        Notification.create(notificationSettingsForDeleteOne),
        Notification.create(notificationSettingsForDeleteOne),
        Notification.create(notificationSettingsForDeleteOneByBody),
        Notification.create(notificationSettingsForDeleteOneByBody),
        Notification.create(notificationSettingsForDeleteMany1),
        Notification.create(notificationSettingsForDeleteMany1),
        Notification.create(notificationSettingsForDeleteMany2),
        Notification.create(notificationSettingsForDeleteMany2)
      ]);

      // Triggering different middlewares
      await Promise.all([
        ask.remove(),
        Ask.deleteOne({_id: askForDeleteOne._id}).exec(),
        Ask.deleteOne({body: askForDeleteOneByBody.body}).exec(),
        Ask.deleteMany({body: askForDeleteMany1.body}).exec()
      ]);

      // Checking if all replies to the asks were deleted
      const [foundReplies, foundRepliesForDeleteOne,
        foundRepliesForDeleteOneByBody,
        foundRepliesForDeleteMany1,
        foundRepliesForDeleteMany2] = await Promise.all([
          Reply.find(replySettings).limit(1),
          Reply.find(replySettingsForDeleteOne).limit(1),
          Reply.find(replySettingsForDeleteOneByBody).limit(1),
          Reply.find(replySettingsForDeleteMany1).limit(1),
          Reply.find(replySettingsForDeleteMany2).limit(1)
      ]);
      expect(foundReplies.length).to.equal(0);
      expect(foundRepliesForDeleteOne.length).to.equal(0);
      expect(foundRepliesForDeleteOneByBody.length).to.equal(0);
      expect(foundRepliesForDeleteMany1.length).to.equal(0);
      expect(foundRepliesForDeleteMany2.length).to.equal(0);


      // Checking if all notifications to the one of the replies were deleted
      const [foundNotifications,
          foundNotificationsForDeleteOne,
          foundNotificationsForDeleteOneByBody,
          foundNotificationsForDeleteMany1,
          foundNotificationsForDeleteMany2] = await Promise.all([
        Notification.find(notificationSettings).limit(1),
        Notification.find(notificationSettingsForDeleteOne).limit(1),
        Notification.find(notificationSettingsForDeleteOneByBody).limit(1),
        Notification.find(notificationSettingsForDeleteMany1).limit(1),
        Notification.find(notificationSettingsForDeleteMany2).limit(1)
      ]);

      expect(foundNotifications.length).to.equal(0);
      expect(foundNotificationsForDeleteOne.length).to.equal(0);
      expect(foundNotificationsForDeleteOneByBody.length).to.equal(0);
      expect(foundNotificationsForDeleteMany1.length).to.equal(0);
      expect(foundNotificationsForDeleteMany2.length).to.equal(0);

      // No cleenup needed, everything has to be deleted already
      return;
    });
    it('should remove all Matches, Notifications referencing this', async () => {
      // Creating ask and offer to be matched,
      // two matches and two notifcations to the offer
      const user = await User.findOne({
        email : 'amit101@alumni.gsb.stanford.edu'
      });
      const offer = await Offer.create({
        owner : user
      });
      const ask = await Ask.create({
        owner : user
      });
      const matchSettings = {
        initiatedBy : 'ask',
        ask : ask,
        askOwner : user,
        offer : offer,
        offerOwner : user,
        matchType : "textSearch"
      };
      const notifSettings = {
        ask : ask
      }
      const docs = await Promise.all([
        Match.create(matchSettings),
        Match.create(matchSettings),
        Notification.create(notifSettings),
        Notification.create(notifSettings)
      ]);

      // Running the function under test
      // Crucial to trigger middleware for '.remove()'
      await ask.remove();

      // Ensuring matches are removed
      const foundMatches = await Match.find(matchSettings).limit(1);
      expect(foundMatches.length).to.equal(0);
      // Ensuring notifications to the offer are removed
      const foundNotifs = await Notification.find(notifSettings).limit(1);
      expect(foundNotifs.length).to.equal(0);

      // Cleanup
      await Offer.deleteMany({_id: offer.id}).exec();
      return;
    });
  });
});
