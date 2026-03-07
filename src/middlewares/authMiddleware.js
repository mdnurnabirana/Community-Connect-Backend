const admin = require("../config/firebase");
const { collections } = require("../config/db");

const verifyJWT = async (req, res, next) => {
  const token = req?.headers?.authorization?.split(" ")[1];
  console.log(token);

  if (!token) {
    return res.status(401).send({ message: "Unauthorized Access!" });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.tokenEmail = decoded.email;
    console.log(decoded);
    next();
  } catch (err) {
    console.log(err);
    return res.status(401).send({ message: "Unauthorized Access!", err });
  }
};

const verifyAdmin = async (req, res, next) => {
  const email = req.tokenEmail;
  const user = await collections.usersCollection.findOne({ email });

  if (user?.role !== "admin") {
    return res
      .status(403)
      .send({ message: "Admin only Actions!", role: user?.role });
  }

  next();
};

const verifyManager = async (req, res, next) => {
  const email = req.tokenEmail;
  const user = await collections.usersCollection.findOne({ email });

  if (user?.role !== "manager") {
    return res
      .status(403)
      .send({ message: "Manager only Actions!", role: user?.role });
  }

  next();
};

module.exports = {
  verifyJWT,
  verifyAdmin,
  verifyManager,
};

