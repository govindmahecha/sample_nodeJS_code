module.exports = function(req, res, next) {
  if (!req.user || !req.isAuthenticated()) {
    return res.status(403).json({ 
    	status: 'error',
    	error: 'Unauthorized',
    	message: 'Unauthorized'
    });
  }
  return next();
};
