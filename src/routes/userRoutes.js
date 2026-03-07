const express = require("express");
const {
  verifyJWT,
  verifyAdmin,
} = require("../middlewares/authMiddleware");
const {
  createUser,
  updateUserRole,
  getAllUsers,
  getUserRole,
  updateUserProfile,
} = require("../controllers/userController");

const router = express.Router();

router.post("/user", createUser);

router.patch("/users/:id/role", verifyJWT, verifyAdmin, updateUserRole);

router.get("/users", verifyJWT, verifyAdmin, getAllUsers);

router.get("/user/role", verifyJWT, getUserRole);

router.patch("/user/profile", verifyJWT, updateUserProfile);

module.exports = router;

