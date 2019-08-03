const mongoose = require('mongoose'),
  Schema = mongoose.Schema,
  ObjectIdSchema = Schema.ObjectId,
  Community = require('./Community');

const ChatSchema = new mongoose.Schema(
  {
    from: { type: ObjectIdSchema, ref: 'User', required: true },
    to: { type: ObjectIdSchema, ref: 'User', required: true },
    message: { type: String },
    readAt: { type: Date }
  },
  { timestamps: true },
);

const Chat = mongoose.model('Chat', ChatSchema);
module.exports = Chat;
