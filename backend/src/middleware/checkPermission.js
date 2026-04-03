const ApiError = require('../utils/ApiError');

const checkPermission = (...requiredPermissions) => {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required'));
    }

    if (req.user.role === 'ADMIN') {
      return next();
    }

    const userPerms = req.user.permissions || [];
    const hasPermission = requiredPermissions.every((perm) => userPerms.includes(perm));

    if (!hasPermission) {
      return next(new ApiError(403, 'Insufficient permissions'));
    }

    next();
  };
};

module.exports = { checkPermission };
