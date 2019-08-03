const Offer = require('../models/Offer');
const Ask = require('../models/Ask');

const offers = {};
const asks = {};

module.exports = {
  bootstrapOffers: async function() {
    if (offers.size > 0) {
      return;
    }
    const offerTags = await Offer.find({}, { tags: 1, owner: 1, _id: 1 });
    bootstrap(offerTags, offers);
  },

  bootstrapAsks: async function() {
    if (asks.size > 0) {
      return;
    }
    const askTags = await Ask.find({}, { tags: 1, owner: 1, _id: 1 });
    bootstrap(askTags, asks);
  },
  matchOffersForAsk: async function(ask) {
    return match(ask, offers);
  },

  matchAsksForOffer: async function(offer) {
    return match(offer, asks);
  },

  updateOffers: async function(owner, tags, offer) {
    update(owner, tags, offer, offers);
  },

  updateAsks: async function(owner, tags, ask) {
    update(owner, tags, ask, asks);
  },
};

const bootstrap = (sourceTags, lookupMap) => {
  sourceTags.forEach(({ owner, tags, _id }) => update(owner, tags, _id, lookupMap));
};

const match = (askOrOffer, lookupMap) => {
  let foundMatches = [];
  askOrOffer.tags.forEach(t => {
    const tag = normalizeTag(t);
    if (lookupMap[tag]) {
      foundMatches = [...foundMatches, ...lookupMap[tag]];
    }
  });
  return foundMatches;
};

const update = (owner, tags, askOrOffer, lookupMap) => {
  tags.forEach(tag => {
    const unspacedTag = normalizeTag(tag);
    const tagOwners = lookupMap[unspacedTag] ? lookupMap[unspacedTag] : new Set([]);
    tagOwners.add({ owner, _id: askOrOffer._id });
    lookupMap[unspacedTag] = tagOwners;
  });
};

const normalizeTag = tag => tag.replace(/[\W\s]+/gim, '').toLowerCase();
