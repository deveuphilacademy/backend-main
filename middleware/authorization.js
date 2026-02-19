
module.exports = (...role) => {

  return (req, res, next) => {
    const userRole = req.user.role?.toLowerCase();
    const allowedRoles = role.map(r => r.toLowerCase());
    console.log(`Checking Auth - User Role: "${userRole}", Allowed: [${allowedRoles}]`);
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        status: "fail",
        error: "You are not authorized to access this"
      });
    }

    next();
  };
};