const express = require("express");
const {
  verifyJWT,
  verifyAdmin,
  verifyManager,
} = require("../middlewares/authMiddleware");
const dashboardController = require("../controllers/dashboardController");

const router = express.Router();

router.get(
  "/member/overview",
  verifyJWT,
  dashboardController.getMemberOverview
);

router.get(
  "/manager/overview",
  verifyJWT,
  verifyManager,
  dashboardController.getManagerOverview
);

router.get(
  "/manager/members-over-time",
  verifyJWT,
  verifyManager,
  dashboardController.getManagerMembersOverTime
);

router.get(
  "/manager/revenue-over-time",
  verifyJWT,
  verifyManager,
  dashboardController.getManagerRevenueOverTime
);

router.get(
  "/admin/overview",
  verifyJWT,
  verifyAdmin,
  dashboardController.getAdminOverview
);

router.get(
  "/admin/users-over-time",
  verifyJWT,
  verifyAdmin,
  dashboardController.getAdminUsersOverTime
);

router.get(
  "/admin/revenue-over-time",
  verifyJWT,
  verifyAdmin,
  dashboardController.getAdminRevenueOverTime
);

module.exports = router;

