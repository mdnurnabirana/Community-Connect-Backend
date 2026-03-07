const express = require("express");
const {
  verifyJWT,
  verifyManager,
} = require("../middlewares/authMiddleware");
const eventController = require("../controllers/eventController");

const router = express.Router();

// Manager: create and manage events
router.post("/events", verifyJWT, verifyManager, eventController.createEvent);

router.get(
  "/manager/events",
  verifyJWT,
  verifyManager,
  eventController.getManagerEvents
);

router.delete(
  "/events/:id",
  verifyJWT,
  verifyManager,
  eventController.deleteEvent
);

router.get(
  "/events/:id",
  verifyJWT,
  verifyManager,
  eventController.getManagerEventById
);

router.patch(
  "/events/:id",
  verifyJWT,
  verifyManager,
  eventController.updateEvent
);

// Public events
router.get("/all-events", eventController.getAllEvents);
router.get("/event/:id", eventController.getEventByIdPublic);

// Event registration & status
router.get(
  "/events/:id/registrationcheck",
  eventController.getEventRegistrationCheck
);

router.post(
  "/events/:id/register",
  verifyJWT,
  eventController.registerForEvent
);

router.post(
  "/events/payment-success",
  eventController.handleEventPaymentSuccess
);

router.get(
  "/my-registered-events",
  verifyJWT,
  eventController.getMyRegisteredEvents
);

router.get(
  "/manager/events/:eventId/registrations",
  verifyJWT,
  verifyManager,
  eventController.getManagerEventRegistrations
);

module.exports = router;

