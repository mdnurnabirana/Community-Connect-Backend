const express = require("express");
const {
  verifyJWT,
  verifyAdmin,
} = require("../middlewares/authMiddleware");
const paymentController = require("../controllers/paymentController");

const router = express.Router();

router.get(
  "/my-payments",
  verifyJWT,
  paymentController.getMyPayments
);

router.get(
  "/admin/payments",
  verifyJWT,
  verifyAdmin,
  paymentController.getAdminPayments
);

module.exports = router;

