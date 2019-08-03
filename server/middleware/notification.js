const Notification = require('./../models/Notification');
const Chat = require('./../models/Chat');
module.exports = async function(req, res, next) {
  try {
    const user = req.user;
    if (!user || !req.isAuthenticated()) {
      return next();
    }

    const unreadChats = await Chat.aggregate([
        { $match: { $and: [{ to: user._id }, { readAt: { $eq: null } }] } },
        { $group: { _id: '$from'} }]);

    if (req.user && req.session) {
      res.set('X-Chat-Count', unreadChats.length);
    }
    return next();
  } catch (e) {
    next(e);
  }
};
