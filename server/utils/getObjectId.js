const ObjectID = require('mongodb').ObjectID;

/**
 * Returns the ObjectId of the object, taking into account
 * whether the object is a populated Model or an ObjectId
 *
 *
 * @alias module:models/Utils.getObjectId
 * @function
 * @static
 * 
 * @param object
 * @return ObjectId
 */
module.exports = function(object){
  const constructor = object.constructor.name.toLowerCase();
  if (constructor === 'objectid'){ return object; }
  if (constructor === 'string'){ return new ObjectID(object); } 
  // else, assume it's a populated model and has an _id property
  const _idConstructor = object._id.constructor.name.toLowerCase();
  if (_idConstructor === 'objectid') { return object._id; } 
  // might be a POJO so coerce it to an ObjectID object
  return new ObjectID(object._id.toString());
}