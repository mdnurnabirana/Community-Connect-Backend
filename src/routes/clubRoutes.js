const express = require("express");
const {
  verifyJWT,
  verifyAdmin,
  verifyManager,
} = require("../middlewares/authMiddleware");
const clubController = require("../controllers/clubController");
const membershipController = require("../controllers/membershipController");

const router = express.Router();

// Manager club CRUD
router.post(
  "/manager/clubs",
  verifyJWT,
  verifyManager,
  clubController.createClub
);

router.get(
  "/manager/clubs",
  verifyJWT,
  verifyManager,
  clubController.getManagerClubs
);

router.get(
  "/manager/clubs/:id",
  verifyJWT,
  verifyManager,
  clubController.getManagerClubById
);

router.patch(
  "/manager/clubs/:id",
  verifyJWT,
  verifyManager,
  clubController.updateManagerClub
);

router.delete(
  "/manager/clubs/:id",
  verifyJWT,
  verifyManager,
  clubController.deleteManagerClub
);

// Admin clubs
router.get(
  "/admin/clubs",
  verifyJWT,
  verifyAdmin,
  clubController.getAdminClubs
);

router.patch(
  "/admin/clubs/:id/status",
  verifyJWT,
  verifyAdmin,
  clubController.updateAdminClubStatus
);

// Public / member club endpoints
router.get("/clubs/approved", clubController.getApprovedClubs);

router.get("/club/:id", clubController.getClubById);

router.post(
  "/clubs/:id/join",
  verifyJWT,
  membershipController.joinClub
);

router.get(
  "/active-memberships",
  verifyJWT,
  membershipController.getActiveMemberships
);

router.get(
  "/club-members/:clubId",
  verifyJWT,
  verifyManager,
  clubController.getClubMembers
);

router.patch(
  "/expire-member/:id",
  verifyJWT,
  verifyManager,
  membershipController.expireMember
);

router.get(
  "/manager-approved/clubs",
  verifyJWT,
  verifyManager,
  clubController.getManagerApprovedClubs
);

router.get(
  "/memberships/club/:clubId/check",
  verifyJWT,
  membershipController.getMembershipCheckForClub
);

router.get("/clubs/featured", clubController.getFeaturedClubs);

// Membership payment success
router.post(
  "/payment-success",
  membershipController.handleMembershipPaymentSuccess
);

module.exports = router;

