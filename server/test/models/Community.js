const mongoose = require('mongoose'),
  Community = require('../../models/Community'),
  Ask = require('../../models/Ask'),
  Offer = require('../../models/Offer'),
  Reply = require('../../models/Reply'),
  Notification = require('../../models/Notification'),
  Tag = require('../../models/Tag'),
  User = require('../../models/User'),
  CommunityJoinLog = require('../../models/CommunityJoinLog'),
  ServerError = require('../../utils/ServerError');
  should = require('should');

const {expect} = require('chai')

describe('Community', () => {

  describe('.create', () => {

    it('should only allow site administrators to create a community');

  });

  describe('#checkUserAccess', () => {
    it("should return true only if user is a member, community admin or site admin", async () => {
      // Create docs for the test: community and 3 users with different privileges
      const user = await User.findOne({
        email : 'amit101@alumni.gsb.stanford.edu'
      });
      const [communityAdmin, nonCommunityMember] = await Promise.all([
        User.create({
          email : 'temp11112@example.com',
          communities : [user.defaultCommunity],
          defaultCommunity : user.defaultCommunity
        }),
        User.create({
          email : 'temp242323@example.com',
          communities : [user.defaultCommunity],
          defaultCommunity : user.defaultCommunity,
        })
      ]);
      const communitySettings = {
        name : 'Test community 123',
        admins : [communityAdmin]
      };
      const adminSettings = {
        email : 'temp3343434@example.com',
        communities : [user.defaultCommunity],
        defaultCommunity : user.defaultCommunity,
        isAdmin : true
      };
      const [admin, community] = await Promise.all([
        User.create(adminSettings),
        Community.create(communitySettings)
      ]);
      const communityMember = await User.create({
        email : 'temp4565655@example.com',
        communities : [community],
        defaultCommunity : community
      });

      // Tests
      expect(community.checkUserAccess(nonCommunityMember)).to.equal(false);
      expect(community.checkUserAccess(communityMember)).to.equal(true);
      expect(community.checkUserAccess(admin)).to.equal(true);
      expect(community.checkUserAccess(communityAdmin)).to.equal(true);

      // Cleanup:
      await Promise.all([
        User.deleteMany({_id: admin.id}).exec(),
        User.deleteMany({_id: communityAdmin.id}).exec(),
        User.deleteMany({_id: communityMember.id}).exec(),
        User.deleteMany({_id: nonCommunityMember.id}).exec(),
        Community.deleteMany({_id: community.id}).exec()
      ]);
      return;
    });
  });

  describe('#isUserAdmin', () => {
    it("should return true only if user is a community admin or site admin", async () => {
      // Create a community and 4 users with different privileges
      const user = await User.findOne({
        email : 'amit101@alumni.gsb.stanford.edu'
      });
      const [communityAdmin, nonCommunityMember] = await Promise.all([
        User.create({
          email : 'temp1111jjj2@example.com',
          communities : [user.defaultCommunity],
          defaultCommunity : user.defaultCommunity
        }),
        User.create({
          email : 'temp24232kkk3@example.com',
          communities : [user.defaultCommunity],
          defaultCommunity : user.defaultCommunity,
        })
      ]);
      const communitySettings = {
        name : 'Test community 1234',
        admins : [communityAdmin]
      };
      const adminSettings = {
        email : 'temp3343434@example.com',
        communities : [user.defaultCommunity],
        defaultCommunity : user.defaultCommunity,
        isAdmin : true
      };
      const [admin, community] = await Promise.all([
        User.create(adminSettings),
        Community.create(communitySettings)
      ]);
      const communityMember = await User.create({
        email : 'temp4565655@example.com',
        communities : [community],
        defaultCommunity : community
      });

      // Tests
      expect(community.isUserAdmin(communityMember)).to.equal(false);
      expect(community.isUserAdmin(nonCommunityMember)).to.equal(false);
      expect(community.isUserAdmin(admin)).to.equal(true);
      expect(community.isUserAdmin(communityAdmin)).to.equal(true);

      // Cleanup:
      await Promise.all([
        User.deleteMany({_id: admin.id}).exec(),
        User.deleteMany({_id: communityAdmin.id}).exec(),
        User.deleteMany({_id: communityMember.id}).exec(),
        User.deleteMany({_id: nonCommunityMember.id}).exec(),
        Community.deleteMany({_id: community.id}).exec()
      ]);
      return;
    });
  });

  describe('#getLatestActivity', () => {
    it("should return a list of community asks and offers sorted by descending updatedAt date", async () => {
      // Create a community and 4 docs for it
      const [user, community] = await Promise.all([
        User.findOne({
          email : 'amit101@alumni.gsb.stanford.edu'
        }),
        Community.create({
          name : "The super test community"
        })
      ]);
      // Sync, because order of creation matters (updatedAt value)
      const doc3 = await Ask.create({
        owner : user,
        body : 'doc3',
        visibility : 'specific-communities',
        communities : community
      });
      const doc2 = await Offer.create({
        owner : user,
        body : 'doc2',
        //  visibility : 'all-communities'
        visibility : 'specific-communities',
        communities : community
      });
      const doc1 = await Offer.create({
        owner : user,
        body : 'doc1',
        visibility : 'specific-communities',
        communities : community
      });
      const doc0 = await Ask.create({
        owner : user,
        body : 'doc0',
        visibility : 'specific-communities',
        communities : community
      });

      // Running function under test, preparing data for tests
      const result = await community.getLatestActivity();
      const list = result.list.map(d => d._id.toString());

      // Tests
      expect(list.length).to.be.at.least(4);
      expect(list[0]).to.equal(doc0._id.toString());
      expect(list[1]).to.equal(doc1._id.toString());
      expect(list[2]).to.equal(doc2._id.toString());
      expect(list[3]).to.equal(doc3._id.toString());

      // Cleanup
      await Promise.all([
        Community.deleteMany({_id: community.id}).exec(),
        Ask.deleteMany({owner: user.id}).exec(),
        Offer.deleteMany({owner: user.id}).exec()
      ]);
      return;
    });

    it("should not include any asks or offers not part of this community", async () => {
      // Create two different communities
      const [user, community, sideCommunity] = await Promise.all([
        User.findOne({
          email : 'amit101@alumni.gsb.stanford.edu'
        }),
        Community.create({
          name : 'Super community 1'
        }),
        Community.create({
          name : 'Super side community 11'
        })
      ]);
      // Create 2 asks per each different community
      const ask3 = await Ask.create({
        owner : user,
        body : 'ask3',
        visibility : 'specific-communities',
        communities : community
      });
      const sideAsk2 = await Ask.create({
        owner : user,
        body : 'sideAsk2',
        visibility : 'specific-communities',
        communities : sideCommunity
      });
      const offer1 = await Offer.create({
        owner : user,
        body : 'offer1',
        visibility : 'specific-communities',
        communities : community
      });
      const sideOffer0 = await Offer.create({
        owner : user,
        body : 'sideOffer0',
        visibility : 'specific-communities',
        communities : sideCommunity
      });

      // Running function under test, preparing data for tests
      const result = await community.getLatestActivity();
      const list = result.list.map(d => d._id.toString());

      // Check that result doesn't contain docs from other communities
      // and is ordered by updatedAt
      expect(list.length).to.be.at.least(2);
      expect(list[0]).to.equal(offer1._id.toString());
      expect(list[1]).to.equal(ask3._id.toString());

      // Cleanup
      await Promise.all([
        Community.deleteMany({_id: community.id}).exec(),
        Community.deleteMany({_id: sideCommunity.id}).exec(),
        Ask.deleteMany({owner: user.id}).exec(),
        Offer.deleteMany({owner: user.id}).exec()
      ]);
      return;
    });
  });


  describe('#addMember', () => {
    it("should require that a correct joinToken is provided", async () => {
      // Create community and two users to use tokens on
      const correctToken = 'CorrectToken-xxxx-yyyy-zzzz',
        incorrectToken = 'IncorrectToken-xxxx-yyyy-zzzz'
      const [userWithCorrectToken, userWithIncorrectToken, community] = await Promise.all([
        User.create({
          email : 'temp1aa3@example.com'
        }),
        User.create({
          email : 'temp1a993@example.com'
        }),
        Community.create({
          name : 'Test community 000ddd',
          joinToken : correctToken
        })
      ]);

      // Expecting no errors
      await community.addMember(userWithCorrectToken, correctToken);
      // Expecting an error to be thrown on incorrect token
      let e = false;
      try {
        await community.addMember(userWithIncorrectToken, incorrectToken);
      } catch (err) {
        e = err;
      }
      expect(e).to.exist;
      expect(e.message).to.equal('Invalid join token');

      // Loading updated user's docs
      const [updUserWithCorrectToken, updUserWithIncorrectToken] = await Promise.all([
        User.findOne({
          _id : userWithCorrectToken.id
        }),
        User.findOne({
          _id : userWithIncorrectToken.id
        })
      ]);

      // Tests
      expect(updUserWithCorrectToken.communities.length).to.be.at.least(1);
      expect(updUserWithCorrectToken.communities, 'user communities').to.include(community.id);
      expect(updUserWithIncorrectToken.communities, 'user communities').to.not.include(community.id);

      // Cleanup
      await Promise.all([
        Community.deleteMany({_id: community.id}).exec(),
        User.deleteMany({_id: userWithCorrectToken.id}).exec(),
        User.deleteMany({_id: userWithIncorrectToken.id}).exec()
      ]);
      return;
    });

    it("should add community to the user's .community list", async () => {
      // Creating test data
      const token = 'test-token-xxxx-yyyy-zzzz';
      const [user, community] = await Promise.all([
        User.create({
          email : 'temp1aa3i@example.com'
        }),
        Community.create({
          name :  'Test community 999a',
          joinToken : token
        })
      ]);

      // Running a function under test
      await community.addMember(user, token);

      // Tests
      expect(user.communities.length).to.be.at.least(1);
      expect(user.communities.map(c => c._id), 'user communities').to.include(community._id);

      // Cleanup
      await Promise.all([
        User.deleteMany({_id: user.id}).exec(),
        Community.deleteMany({_id: community.id}).exec()
      ]);
      return;
    });

    it("should add an entry into the CommunityJoinLog collection", async () => {
      // Creating docs for the test
      const token = 'test-token-xxxx-yyyy-zzzz';
      const [user, community] = await Promise.all([
        User.create({
          email : 'temp1aa3ai@example.com'
        }),
        Community.create({
          name :  'Test community 777aaa',
          joinToken : token
        })
      ]);

      // Running function under test
      await community.addMember(user, token);

      // Checking if log entry created
      let result = await CommunityJoinLog.find({
        'owner' : user.id,
        'targetUser' : user.id,
        'action' : 'join',
        'community' : community.id
      }).limit(1);
      expect(result.length).to.equal(1);

      // Cleanup
      await Promise.all([
        User.deleteOne({_id: user.id}),
        Community.deleteOne({_id: community.id})
      ]);
      return;
    });
    it("should send the user a confirmation email", async () => {
      const { sendJoinedCommunityConfirmation } = require('../../utils/sendEmail');

      // Passing correct data
      const [response] = await sendJoinedCommunityConfirmation(
        'user.email@mock.com',
        'user.profile.firstName/John',
        'user.profile.lastName/Doe',
        `community.name/Google`,
        `https://google.com/random-mock-url`
      );
      expect(response.statusCode).to.equal(200);
      // Passing incorrect data
      let e = false;
      try {
        const response2 = await sendJoinedCommunityConfirmation(
          'not-an-email',
          'user.profile.firstName/John',
          'user.profile.lastName/Doe',
          `community.name/Google`,
          `not-an-url`
        );
      } catch (err) {
        e = err;
      }
      expect(e).to.exist;
      expect(e.message).to.equal('Bad Request');

      // Preparing test data
      const token = 'test-token-xxxx-yyyy-zzzz';
      const sourceUrl = 'https://random.url';
      const req = {
        protocol: 'https',
        hostname: 'randomhost'
      }
      // Creating docs for the test
      const [user, userWithNotEmail, community] = await Promise.all([
        User.create({
          email : 'temp1aa3ai@example.com'
        }),
        User.create({
          email : 'not-an-email'
        }),
        Community.create({
          name :  'Test community 777aaa',
          joinToken : token
        })
      ]);

      // Running function under test. No errors should arise
      await community.addMember(user, token, sourceUrl, req);

      // Passing incorrect data
      e = false;
      try {
        await community.addMember(userWithNotEmail, token, sourceUrl, req);
      } catch (err) {
        e = err;
      }
      expect(e).to.exist;
      expect(e.message).to.equal('Bad Request');

      // Cleanup
      await Promise.all([
        User.deleteOne({id: user._id}).exec(),
        User.deleteOne({id: user._id}).exec(),
        Community.deleteOne({id: community._id}).exec()
      ]);
      return;
    });

    it("should prevent user from joining if user is in community.blockedUsers", async () => {
      // Creating docs for the test
      const token = 'test-token-xxxx-yyyy-zzz';
      const [admin, user, community] = await Promise.all([
        User.create({
          email : 'temp777@example.com',
          isAdmin : true
        }),
        User.create({
          email : 'temp7777@example.com'
        }),
        Community.create({
          name :  'Test community 777a',
          joinToken : token
        })
      ]);

      await community.blockUser(admin, user);

      // Expecting an error on attempt to add a blocked user
      let e = false;
      try {
        await community.addMember(user, token);
      } catch (err) {
        e = err;
      }
      expect(e).to.exist;
      expect(e.message).to.equal('User is blocked from this community');

      // Cleanup
      await Promise.all([
        Community.deleteOne({_id: community.id}).exec(),
        User.deleteOne({_id: user.id}).exec(),
        User.deleteOne({_id: admin.id}).exec()
      ]);
      return;
    });
  });

  describe('#blockUser', () => {
    it("should add user to .blockedUsers", async () => {
      // Create docs for the test
      const communityAdmin = await User.create({
        email : 'temp3asdas34@example.com'
      });
      const [userToBlock, community] = await Promise.all([
        User.create({
          email : 'temp0001a@example.com'
        }),
        Community.create({
          name : 'Test community 299923',
          admins : [communityAdmin]
        })
      ]);

      // Running the function under test
      await community.blockUser(communityAdmin, userToBlock);

      // Checking if it added user to .blockedUsers
      const updatedCommunity = await Community.findOne({
        _id : community.id
      });
      expect(community.blockedUsers.length).to.be.at.least(1);
      expect(community.blockedUsers, 'community blocked users').to.include(userToBlock._id);

      // Cleanup
      await Promise.all([
        Community.deleteOne({_id: community.id}).exec(),
        User.deleteOne({_id: userToBlock.id}).exec(),
        User.deleteOne({_id: communityAdmin.id}).exec()
      ]);
      return;
    });

    it("should only allow site administrators and community administrators to block a user", async () => {
      // Create a community, 3 users with different privileges and 3 users to be blocked
      const communityAdmin = await User.create({
        email : 'temp3asdas34@example.com'
      });
      const [siteAdmin, commonUser, userToBlockBySiteAdmin,
        userToBlockByComAdmin, userToBlockByUser,
         community] = await Promise.all([
        User.create({
          email : 'temp0003a@example.com',
          isAdmin : true,
          profile : {
            bio: 'temp test user'
          }
        }),
        User.create({
          email : 'temp00099a@example.com',
          profile : {
            bio: 'temp test user'
          }
        }),
        User.create({
          email : 'temp0009999a@example.com',
          profile : {
            bio: 'temp test user'
          }
        }),
        User.create({
          email : 'temp01230099a@example.com',
          profile : {
            bio: 'temp test user'
          }
        }),
        User.create({
          email : 'temp0001a@example.com',
          profile : {
            bio: 'temp test user'
          }
        }),
        Community.create({
          name : 'Test community 299923',
          admins : [communityAdmin]
        })
      ]);

      // Expecetig no errors
      await community.blockUser(communityAdmin, userToBlockByComAdmin);
      await community.blockUser(siteAdmin, userToBlockBySiteAdmin);
      // Expecting an error
      let e = false;
      try {
        await community.blockUser(commonUser, userToBlockByUser);
      } catch (err) {
        e = err;
      }
      expect(e).to.exist;
      expect(e.message).to.equal('Unauthorized attempt to block a user');

      // Checking if list of blocked users is correct
      const updatedCommunity = await Community.findOne({
        _id : community.id
      });
      expect(community.blockedUsers.length).to.be.at.least(2);
      expect(community.blockedUsers, 'blocked users').to.include(userToBlockByComAdmin._id);
      expect(community.blockedUsers, 'blocked users').to.include(userToBlockBySiteAdmin._id);
      expect(community.blockedUsers, 'blocked users').to.not.include(userToBlockByUser._id);

      // Cleanup
      await Promise.all([
        Community.deleteOne({_id: community.id}).exec(),
        User.deleteMany({"profile.bio": 'temp test user'})
      ]);
      return;
    });
  });
});
