const ApiError = require('../utils/ApiError');

const companyScope = (req, _res, next) => {
  if (!req.user || !req.user.companyId) {
    return next(new ApiError(401, 'Company context required'));
  }

  req.companyId = req.user.companyId;
  next();
};

module.exports = { companyScope };
