const { notification: NotificationEndpoint } = require('./../../common/endpoints');
const Ask = require('./../models/Ask');
const Offer = require('./../models/Ask');
const Notification = require('./../models/Notification');
const checkAuthentication = require('../middleware/checkAuthentication');

module.exports = function(app) {
  app.get(NotificationEndpoint.getAskOffer, checkAuthentication, async (req, res, next) => {
    const user = req.user;
    try {
      const populateAskOffer = [
        { path: 'owner', select: 'profile' },
        { path : 'tagsDisplay' },
        {
          path: 'replies',
          options: {
            sort: {
              updatedAt: 1,
            },
          },
          populate: {
            path: 'owner',
            select: 'profile',
          },
        },
      ];

      const askOfferNotifications = await Notification.find({
        owner : req.user,
        $or : [
          { ask : { $exists : true } },
          { offer : { $exists : true } }
        ]
//        readAt : { $exists : false }
      })
      .populate({
        path : 'ask',
        populate : populateAskOffer
      })
      .populate({
        path : 'offer',
        populate : populateAskOffer
      })
      .populate({
        path : 'reply',
        populate : {
          path : 'owner',
          select : 'profile'
        }
      })
      .populate({
        path : 'chat',
        populate : [
          {
            path : 'from',
            select: 'profile'
          }
        ]
      })
      .sort({
        createdAt: -1
      })
      .lean();

      res.json(askOfferNotifications);
    } catch (e) {
      next(e);
    }
  });

  app.post(NotificationEndpoint.updateStatus, checkAuthentication, async (req, res, next) => {
    try {
      const user = req.user;
      const  status  = req.query.status;
      const id = req.params.id;
      const notification = await Notification.findById(id);
      if (notification) {
        notification.currentStatus = status;
        if (!notification.readAt) {
          notification.readAt = new Date();
        }
      }
      await notification.save();
      res.json(notification);
    } catch (e) {
      next(e);
    }
  });
};
