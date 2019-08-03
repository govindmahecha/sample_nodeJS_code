const mongoose = require('mongoose'),
  Schema = mongoose.Schema,
  ObjectIdSchema = Schema.ObjectId,
  Reply = require('./Reply'),
  Match = require('./Match'),
  Tag = require('./Tag'),
  Notification = require('./Notification'),
  Enums = require('./../../common/enums');

const getObjectId = require('./../utils/getObjectId');
const getObjectIdString = function(obj){
  return getObjectId(obj).toString();
};

const { logger } = require('./../utils/logger');

const AskSchema = new mongoose.Schema(
  {
    owner: { type: ObjectIdSchema, ref: 'User', required: true },

    lookingFor : {
      type: String,
      enum: Object.keys(Enums.ask.lookingFor),
      default: 'other',
    },

    desiredResponseType : {
      type: String,
      enum: Object.keys(Enums.ask.desiredResponseType),
      default: 'other',
    },

    body: { type: String },

    /*
     * Stores entries that map to Tag collection keys
     */
    tags: [{ type: String }],

    visibility: {
      type: String,
      enum: Object.keys(Enums.postVisibility),
      default: 'all-communities',
    },

    /*
     * Required
     * The communities this Ask is visible to
     */
    communities: [
      {
        type: ObjectIdSchema,
        ref: 'Community',
      },
    ],

    upvotes: [
      {
        type: ObjectIdSchema,
        ref: 'User',
      },
    ],

    followers : [
      {
        type: ObjectIdSchema,
        ref: 'User',
      },
    ],

    /*
     * Contains all concatenated reply bodies.
     */
    repliesSearchBlob: String,

    selectedResponse: { type: ObjectIdSchema, ref: 'Reply' },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

AskSchema.virtual('replies', {
  ref: 'Reply',
  localField: '_id',
  foreignField: 'replyTo.value',
});

AskSchema.virtual('matches', {
  ref: 'Match',
  localField: '_id',
  foreignField: 'ask',
});

AskSchema.virtual('tagsDisplay', {
  ref: 'Tag',
  localField: 'key',
  foreignField: 'tags',
});

AskSchema.index({ selectCommunities: 1 });
AskSchema.index({ tags: 1 });
AskSchema.index(
  { 'body': 'text', 'tags': 'text' },
  { weights:
    { body: 1, tags: 5 }
  }
);

AskSchema.pre('save', async function(next) {
  var bodyIsModified = this.isModified('body');
  if (!this.isNew && bodyIsModified) {
    this.upsertMatchedOffers();
  }
  next();
});

AskSchema.pre('save', function(next) {
  if (this.visibility !== 'public' && !this.communities.length) {
    this.communities = this.owner.communities;
  }
  next();
});

AskSchema.pre('save', async function(next) {
  await this.updateSearchBlob();
  next();
});

/*
 * Update Tag collection with any new tags
 */
AskSchema.pre('save', async function() {
  var isModified = this.isModified('tags');
  if (!isModified) {
    return;
  }

  let tagSet = new Set();
  this.tags.forEach(tag => {
    tagSet.add(Tag.normalize(tag));
  });

  const upsertedTags = await Promise.all(
    Array.from(tagSet).map(async (tag) => {
      let tagKey = Tag.getKey(tag);
      const options = { upsert: true, new: true, setDefaultsOnInsert: true };
      return await Tag.findOneAndUpdate(
        { key : tagKey },
        {
          key : tagKey,
          display : tag
        }, options);
    })
  );

  this.tags = Array.from(new Set(upsertedTags.map(tag => {
    return tag.key;
  })));
});



AskSchema.pre('remove', async function() {
  const _id = this._id;
  return await deleteDependentDocsByAskId(_id);
});

AskSchema.pre('deleteOne', async function () {
  let _id = this._conditions._id;
  if(_id) {
    return await deleteDependentDocsByAskId(_id);
  }
  let ask = await Ask.findOne(this._conditions);
  _id = ask._id;
  return await deleteDependentDocsByAskId(_id);
});

AskSchema.pre('deleteMany', async function () {
  const asks = await Ask.find(this._conditions);
  const asks_ids = asks.map(ask => ask._id);
  let deletingProcesses = [];
  for(let _id of asks_ids) {
    deletingProcesses.push(
      deleteDependentDocsByAskId(_id)
    );
  }
  return await Promise.all(deletingProcesses);
});

async function deleteDependentDocsByAskId(_id) {
  let deletionProcesses = [];
  deletionProcesses.push(
    Match.deleteMany({ask: _id}).exec()
  );
  deletionProcesses.push(
    Reply.deleteMany({
      replyTo: {
        refToModel: 'Ask',
        value: _id
      }
    }).exec()
  );
  deletionProcesses.push(
    Notification.deleteMany({ask: _id}).exec()
  );
  return await Promise.all(deletionProcesses);
}

AskSchema.methods.getMatchedOffers = async function(matchThreshold = 5) {
  const Offer = require('./Offer');

  let textSearch = this.body.replace(/\b(help|advice|recommendation)\b/g, '');
  textSearch += ' ' + this.tags.join(',');
  const ownerId = getObjectId(this.owner);

  let [ tagMatches, textMatches ] = await Promise.all([
    Offer.find({ 
      communities : { $in : this.communities },
      tags : { $in : this.tags },
      owner : { $ne : ownerId }
    }),
    Offer.find({
      communities : { $in : this.communities },
      $text :  { $search: textSearch },
      owner : { $ne : ownerId }
    },
    { score: { $meta: "textScore" } }
    )
    .sort( { score: { $meta: "textScore" } } )
  ]);

  textMatches = textMatches.filter(m => {
    return m._doc.score >= matchThreshold
  });

  return { tagMatches, textMatches };
};

AskSchema.methods.upsertMatchedOffers = async function() {
  const Match = require('./Match');
  let removingOldMatches = Match.deleteMany({ask: this}).exec();

  let {tagMatches, textMatches} = await this.getMatchedOffers();

  const options = { upsert: true, new: true, setDefaultsOnInsert: true };
  await removingOldMatches;
  const matchDocs = await Promise.all(
    textMatches.map(offer => {
      let communitySet = new Set(this.communities.map(getObjectIdString), offer.communities.map(getObjectIdString));
      return Match.findOneAndUpdate({
        ask : this,
        offer
      },{
        initiatedBy : 'ask',
        ask : this,
        askOwner : this.owner,
        offer,
        offerOwner : offer.owner,
        communities : [...communitySet],
        matchType : 'textSearch',
        textMatchScore : offer._doc.score
      },
      options)
    })
  );
  const notificationDocs = await Promise.all(
    matchDocs.map(match => {
      return match.updateNotification();
    })
  );

  return matchDocs;
};

AskSchema.methods.updateSearchBlob = async function() {
  const replies = await Reply.find({
    'replyTo.refToModel': 'Ask',
    'replyTo.value': this._id,
  });

  var textPieces = [];
  replies.forEach(reply => {
    textPieces.push(reply.body);
  });

  this.repliesSearchBlob = textPieces.join(' ').toLowerCase();
  return;
};

const Ask = mongoose.model('Ask', AskSchema);

module.exports = Ask;
