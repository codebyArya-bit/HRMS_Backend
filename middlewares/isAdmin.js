export const isAdmin = (req, res, next) => {
  if (req.user?.role === "ADMIN") next();
  else res.status(403).json({ error: "Access denied. Admins only." });
};
