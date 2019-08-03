const bcrypt = require('bcrypt-nodejs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Schema = mongoose.Schema,
  ObjectIdSchema = Schema.ObjectId;
const normalizeUrl = require('normalize-url');
const CommunityJoinLog = require('./CommunityJoinLog');
const Ask = require('./Ask');
const Offer = require('./Offer');
const Enums = require('./../../common/enums');

const UserSchema = new mongoose.Schema(
  {
    isAdmin: { type: Boolean, default: false },
    canCreateCommunities: { type: Boolean, default: false },

    password: String,
    passwordResetToken: String,
    passwordResetExpires: Date,

    email: { type: String, unique: true },
    
    verifyEmailToken: ObjectIdSchema,
    verifyEmailExpires: Date,
    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    socialAuthIds: {
      facebook: String,
      twitter: String,
      google: String,
      linkedin: String,
    },

    authTokens: [
      {
        kind: String,
        accessToken: String,
      },
    ],

    /* 
     * All data in .profile is public to community members
     */
    profile: {
      firstName: String,
      lastName: String,
      name: String,
      location: String,
      website: String,
      picture: String,
      gravatar: String,
      linkedInUrl: String,
      bio : String,
      willingResponseTypes: [{
        type: String,
        enum: Object.keys(Enums.ask.desiredResponseType),
      }],
    },

    preferences : {
      notifications : {
        emailOnReplies : {
          type : Boolean,
          default: true
        },
        emailOnDirectMessages : {
          type : Boolean,
          default: true
        },  
      }
    },

    totalPoints: Number,

    /*
     * Metadata from LinkedIn or Google signin. Not to be exposed to the end user
     */
    linkedInProfile: Schema.Types.Mixed,
    googleProfile: Schema.Types.Mixed,

    communities: [
      {
        type: ObjectIdSchema,
        ref: 'Community',
      },
    ],

    defaultCommunity: {
      type: ObjectIdSchema,
      ref: 'Community',
    },

    /*
   * Time of latest activity, including updates or replies 
   */
    latestActivityAt: Date,
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

UserSchema.virtual('asks', {
  ref: 'Ask',
  localField: '_id',
  foreignField: 'owner',
  options: { sort: { updatedAt: -1 }}
});

UserSchema.virtual('offers', {
  ref: 'Offer',
  localField: '_id',
  foreignField: 'owner',
  options: { sort: { updatedAt: -1 }}
});

UserSchema.virtual('replies', {
  ref: 'Reply',
  localField: '_id',
  foreignField: 'owner',
  options: { sort: { updatedAt: -1 }}
});

UserSchema.virtual('askUpvotes', {
  ref: 'Ask',
  localField: '_id',
  foreignField: 'upvotes'
});

UserSchema.virtual('offerUpvotes', {
  ref: 'Offer',
  localField: '_id',
  foreignField: 'upvotes'
});

UserSchema.virtual('replyUpvotes', {
  ref: 'Reply',
  localField: '_id',
  foreignField: 'upvotes'
});

UserSchema.virtual('communityJoinLog', {
  ref: 'CommunityJoinLog',
  localField: '_id',
  foreignField: 'targetUser',
});

UserSchema.pre('save', function(next) {
  this.latestActivityAt = new Date();
  next();
});

/**
 * Password hash middleware.
 */
UserSchema.pre('save', function save(next) {
  const user = this;
  if (!user.isModified('password')) {
    return next();
  }
  bcrypt.genSalt(12, (err, salt) => {
    if (err) {
      return next(err);
    }
    bcrypt.hash(user.password, salt, null, (err, hash) => {
      if (err) {
        return next(err);
      }
      user.password = hash;
      next();
    });
  });
});

UserSchema.pre('save', function(next) {
  var linkedInUrl = this.profile.linkedInUrl;
  try {
    if (this.profile.linkedInUrl) {
      this.profile.linkedInUrl = normalizeUrl(linkedInUrl);
    }
  } catch (e) {
    this.profile.linkedInUrl = linkedInUrl;
  }
  next();
});

UserSchema.pre('save', function(next) {
  if (!this.defaultCommunity && this.communities.length) {
    this.defaultCommunity = this.communities[0];
  }
  next();
});


UserSchema.pre('save', function(next) {
  if (this.profile.firstName && this.profile.lastName){
    return next();
  }
  if (this.googleProfile && this.googleProfile.name){
    this.profile.firstName = this.profile.firstName || this.googleProfile.name.givenName;
    this.profile.lastName = this.profile.lastName || this.googleProfile.name.familyName;
  }
  if (this.linkedInProfile && this.linkedInProfile.name){
    this.profile.firstName = this.profile.firstName || this.linkedInProfile.name.givenName;
    this.profile.lastName = this.profile.lastName || this.linkedInProfile.name.familyName;
  }
  if (this.isModified('profile.firstName') || this.isModified('profile.lastName')){
    this.profile.name = `${this.profile.firstName || ''} ${this.profile.lastName || ''}`.trim();
  }
  
  next();
});



/*
 * Ensure the user has a gravatar
 */
UserSchema.pre('save', function(next) {
  if (!this.profile.gravatar) {
    const md5 = crypto
      .createHash('md5')
      .update(this.email)
      .digest('hex');
    this.profile.gravatar = `https://gravatar.com/avatar/${md5}?s=100&d=mp`;
  }
  next();
});

UserSchema.methods.sendEmailVerification = async function(protocol, hostname, returnTo){
  const { sendEmailVerification } = require('../utils/sendEmail');
  const user = this;
  user.verifyEmailToken = new mongoose.Types.ObjectId();
  user.verifyEmailExpires = Date.now() + (24 * 60 * 60 * 1000);
  
  await user.save();
  
  let verificationUrl = '';
  if (returnTo){
    verificationUrl = `${protocol}://${hostname}/verify-email/${user.verifyEmailToken}?returnTo=${returnTo}`;
  } else {
    verificationUrl = `${protocol}://${hostname}/verify-email/${user.verifyEmailToken}`;
  }

  return await sendEmailVerification(
    user.email,
    verificationUrl
  );
};

UserSchema.methods.checkUserAccess = function(user) {
  const userId = user && user._id;
  if (!userId) {
    return false;
  } else if (!user.isEmailVerified) {
    return false;
  }
  return (
    user.isAdmin ||
    user.communities.some(function(theirCommunityId) {
      var found = this.communities.some(function(myCommunityId) {
        theirCommunityId.equals(myCommunityId._id);
      });
      return found;
    })
  );
};

UserSchema.methods.getCommunities = async function(fields) {
  await this.populate({ path: 'communities', select: fields.join(' ') }).execPopulate();
  return this;
};

UserSchema.methods.toSelfJson = async function(skipVirtuals) {
  await this.getCommunities(['slug', 'name', 'prefs']);

  let result = {
    email: this.email,
    isEmailVerified: this.isEmailVerified,
    socialAuthIds: this.socialAuthIds,
    profile: this.profile,
    isAdmin: this.isAdmin,
    totalPoints: this.totalPoints,
    communities: this.communities,
    defaultCommunity: this.defaultCommunity,
    id: this._id,
    _id : this._id
  };

  if (!skipVirtuals){
    const askQuery = await Ask.find({owner: this._id})
      .populate('owner', 'profile')
      .populate({
        path: 'replies',
        options: {
          sort: {
            updatedAt: 1,
          },
        },
        // Get owners of replies
        populate: {
          path: 'owner',
          select: 'profile',
        },
      })
      .sort({ updatedAt: -1 })
      .lean();

    const offerQuery = await Offer.find({owner: this._id})
      .populate('owner', 'profile')
      .populate({
        path: 'replies',
        options: {
          sort: {
            updatedAt: 1,
          },
        },
        // Get owners of replies
        populate: {
          path: 'owner',
          select: 'profile',
        },
      })
      .sort({ updatedAt: -1 })
      .lean();

    result.asks = askQuery;
    result.offers = offerQuery;
  }

  return result;
};

/**
 * @param communityId
 * @param format : options: 'fullActivity', 'summary'
 */
UserSchema.methods.toCommunityJson = async function(communityId, format = 'summary') {
  const userQuery = User.findById(this._id)
  .select('profile totalPoints')
  .lean()

  if (format === 'fullActivity'){
    userQuery.populate({
      path: 'asks',
      match: { communities: { $in: [communityId] }},
      populate : { 
        path : 'replies',
        // Get owners of replies
        populate: {
          path: 'owner',
          select: 'profile',
        },
      },
      options: {
        sort: {
          updatedAt: 1,
        },
      },
    })
    .populate({
      path: 'offers',
      match: { communities: { $in: [communityId] }},
      populate : { 
        path : 'replies',
        // Get owners of replies
        populate: {
          path: 'owner',
          select: 'profile',
        },
      },
      options: {
        sort: {
          updatedAt: 1,
        },
      },
    })
    .populate({
      path: 'replies',
      match: { communities: { $in: [communityId] }},
      populate: { 
        path: 'replyTo.value',
        populate : {
          path : 'owner',
          select : 'profile'
        }
      },
      options: {
        sort: {
          updatedAt: 1,
        },
      },
    })
  }

  const user = await userQuery.exec();

  return {
    _id : user._id,
    id : user._id,
    profile: user.profile,
    totalPoints: user.totalPoints,
    asks : user.asks,
    offers : user.offers,
    replies : user.replies
  };
};

UserSchema.methods.toCookieJson = async function() {
  await Promise.all([
    this.populate({path: 'defaultCommunity', select: 'slug name'}),
    this.getCommunities(['slug', 'name'])
  ]);

  return {
    id: this._id,
    email: this.email,
    isEmailVerified: this.isEmailVerified,
    profile: {
      firstName : this.profile.firstName,
      lastName : this.profile.lastName,
      name : this.profile.name,
      picture : this.profile.picture,
      gravatar : this.profile.gravatar,
    },
    isAdmin: this.isAdmin,
    defaultCommunity: this.defaultCommunity ? this.defaultCommunity.toMinJSON() : undefined,
    communities: this.communities.map(comm => comm.toMinJSON()),
  };
};

UserSchema.methods.comparePassword = async function(password, done) {
  bcrypt.compare(password, this.password, function(err, isMatch) {
    if (err) return done(err);
    done(null, isMatch);
  });
};

const User = mongoose.model('User', UserSchema);

module.exports = User;
