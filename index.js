require("dotenv").config();
const express = require("express");
const cors = require("cors");
const port = process.env.PORT || 3000;
const admin = require("firebase-admin");
const serviceAccount = require("./firebaseAdminSDK.json");
const { ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = process.env.Mongo_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const app = express();
app.use(cors());
app.use(express.json());

// Member role verification middleware via - JWT (Firebase)
const verifyJWT = async (req, res, next) => {
  const token = req?.headers?.authorization?.split(" ")[1];
  console.log(token);
  if (!token) return res.status(401).send({ message: "Unauthorized Access!" });
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

async function run() {
  try {
    await client.connect();

    // Database
    const db = client.db("communityDB");

    // All db collection's
    const usersCollection = db.collection("users");
    const clubsCollection = db.collection("clubs");
    const membershipsCollection = db.collection("memberships");
    const eventsCollection = db.collection("events");
    const eventRegistrationCollection = db.collection("eventRegistrations");
    const paymentsCollection = db.collection("payments");

    // Admin role verification middleware
    const verifyAdmin = async (req, res, next) => {
      const email = req.tokenEmail;
      const user = await usersCollection.findOne({ email });
      if (user?.role !== "admin")
        return res
          .status(403)
          .send({ message: "Admin only Actions!", role: user?.role });
      next();
    };

    // Manager role verification middleware
    const verifyManager = async (req, res, next) => {
      const email = req.tokenEmail;
      const user = await usersCollection.findOne({ email });
      if (user?.role !== "manager")
        return res
          .status(403)
          .send({ message: "Manager only Actions!", role: user?.role });

      next();
    };

    // Save user into collection
    app.post("/user", async (req, res) => {
      try {
        const { email, ...rest } = req.body;

        if (!email) {
          return res.status(400).send({ message: "Email is required" });
        }

        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) {
          return res.status(200).send(existingUser);
        }

        const newUser = {
          email,
          ...rest,
          role: "member",
          createdAt: new Date(),
        };

        const result = await usersCollection.insertOne(newUser);

        res.status(201).send({
          message: "User created",
          user: { ...newUser, _id: result.insertedId },
        });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });

    // Update Role API
    app.patch("/users/:id/role", verifyJWT, verifyAdmin, async (req, res) => {
      const { id } = req.params;
      const { role } = req.body;

      const user = await usersCollection.findOne({ _id: new ObjectId(id) });
      if (!user) return res.status(404).send({ message: "User not found" });

      if (user.email === req.tokenEmail && role === "manager") {
        return res.status(403).send({ message: "Not allowed" });
      }

      await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role } }
      );

      res.send({ success: true });
    });

    // Get All User's
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // Get user Role
    app.get("/user/role", verifyJWT, async (req, res) => {
      const result = await usersCollection.findOne({ email: req.tokenEmail });
      res.send({ role: result?.role });
    });

    // Club Related Api's
    app.post("/manager/clubs", verifyJWT, verifyManager, async (req, res) => {
      try {
        const club = req.body;

        const newClub = {
          ...club,
          status: "pending",
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const result = await clubsCollection.insertOne(newClub);

        res.send({
          success: true,
          clubId: result.insertedId,
        });
      } catch (err) {
        res.status(500).send({ message: "Server error" });
      }
    });

    // Get All Clubs (Only Own Clubs)
    app.get("/manager/clubs", verifyJWT, verifyManager, async (req, res) => {
      try {
        const email = req.tokenEmail;

        const clubs = await clubsCollection
          .find({ managerEmail: email })
          .toArray();

        res.send(clubs);
      } catch (err) {
        res.status(500).send({ message: "Server error" });
      }
    });

    // Manager's Club
    app.get(
      "/manager/clubs/:id",
      verifyJWT,
      verifyManager,
      async (req, res) => {
        try {
          const email = req.tokenEmail;
          const clubId = req.params.id;

          const club = await clubsCollection.findOne({
            _id: new ObjectId(clubId),
            managerEmail: email,
          });

          if (!club) {
            return res
              .status(404)
              .send({ message: "Club not found or unauthorized" });
          }

          res.send(club);
        } catch (err) {
          res.status(500).send({ message: "Server error" });
        }
      }
    );

    // Update Club (Only Own Club)
    app.patch(
      "/manager/clubs/:id",
      verifyJWT,
      verifyManager,
      async (req, res) => {
        try {
          const email = req.tokenEmail;
          const clubId = req.params.id;

          const updateData = {
            ...req.body,
            updatedAt: new Date(),
          };

          const result = await clubsCollection.updateOne(
            {
              _id: new ObjectId(clubId),
              managerEmail: email,
            },
            { $set: updateData }
          );

          if (!result.matchedCount) {
            return res
              .status(404)
              .send({ message: "Club not found or unauthorized" });
          }

          res.send({ success: true, message: "Club updated successfully" });
        } catch (err) {
          res.status(500).send({ message: "Server error" });
        }
      }
    );

    // Delete Club (Only Own Club)
    app.delete(
      "/manager/clubs/:id",
      verifyJWT,
      verifyManager,
      async (req, res) => {
        try {
          const email = req.tokenEmail;
          const clubId = req.params.id;

          const result = await clubsCollection.deleteOne({
            _id: new ObjectId(clubId),
            managerEmail: email,
          });

          if (!result.deletedCount) {
            return res
              .status(404)
              .send({ message: "Club not found or unauthorized" });
          }

          res.send({ success: true, message: "Club deleted successfully" });
        } catch (err) {
          res.status(500).send({ message: "Server error" });
        }
      }
    );

    // Get All Clubs (Admin Only)
    app.get("/admin/clubs", verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const clubs = await clubsCollection.find({}).toArray();
        res.send(clubs);
      } catch (err) {
        res.status(500).send({ message: "Server error" });
      }
    });

    // Update Club Status (Admin Only)
    app.patch(
      "/admin/clubs/:id/status",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        try {
          const clubId = req.params.id;
          const { status } = req.body;

          if (!status) {
            return res.status(400).send({ message: "Status is required" });
          }

          const result = await clubsCollection.updateOne(
            { _id: new ObjectId(clubId) },
            {
              $set: {
                status,
                updatedAt: new Date(),
              },
            }
          );

          if (!result.matchedCount) {
            return res.status(404).send({ message: "Club not found" });
          }

          res.send({ success: true, message: "Status updated successfully" });
        } catch (err) {
          res.status(500).send({ message: "Server error" });
        }
      }
    );

    // Get all approved clubs
    app.get("/clubs/approved", async (req, res) => {
      try {
        const approvedClubs = await clubsCollection
          .find({ status: "approved" })
          .toArray();
        res.send(approvedClubs);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });

    // GET /clubs/:id
    app.get("/club/:id", async (req, res) => {
      const { id } = req.params;

      try {
        const club = await clubsCollection.findOne({ _id: new ObjectId(id) });

        if (!club) {
          return res.status(404).json({ message: "Club not found" });
        }

        res.json(club);
      } catch (err) {
        res.status(500).json({ message: "Server error" });
      }
    });

    // Join club & redirect based on price
    app.post("/clubs/:id/join", verifyJWT, async (req, res) => {
      try {
        const clubId = req.params.id;
        const userEmail = req.tokenEmail;

        if (!ObjectId.isValid(clubId)) {
          return res.status(400).send({ message: "Invalid club id" });
        }

        const club = await clubsCollection.findOne({
          _id: new ObjectId(clubId),
        });

        if (!club) {
          return res.status(404).send({ message: "Club not found" });
        }

        const existingMembership = await membershipsCollection.findOne({
          clubId: clubId,
          userEmail: userEmail,
        });

        if (existingMembership) {
          return res
            .status(400)
            .send({ message: "You already joined this club" });
        }

        if (club.membershipFee === 0) {
          const membership = {
            userEmail,
            clubId,
            status: "active",
            joinedAt: new Date(),
            expiresAt: null,
            paymentId: null,
          };

          await membershipsCollection.insertOne(membership);

          return res.send({
            free: true,
            message: "Joined successfully",
          });
        }

        const pendingMembership = {
          userEmail,
          clubId,
          status: "pendingPayment",
          joinedAt: new Date(),
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
          paymentId: null,
        };

        const result = await membershipsCollection.insertOne(pendingMembership);

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: [
            {
              price_data: {
                currency: "usd",
                product_data: {
                  name: club.clubName,
                  description: club.description,
                  images: club.bannerImage ? [club.bannerImage] : [],
                },
                unit_amount: club.membershipFee * 100,
              },
              quantity: 1,
            },
          ],
          mode: "payment",
          customer_email: userEmail,
          metadata: {
            membershipId: result.insertedId.toString(),
            clubId: clubId,
            userEmail: userEmail,
          },
          success_url: `${process.env.CLIENT_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.CLIENT_DOMAIN}/club/${clubId}`,
        });

        res.send({
          free: false,
          checkoutUrl: session.url,
        });
      } catch (err) {
        console.error("JOIN CLUB ERROR DETAILS:");
        console.error(err);
        res.status(500).send({
          message: "Internal server error",
          error: err.message,
        });
      }
    });

    app.post("/payment-success", async (req, res) => {
      try {
        const { sessionId } = req.body;

        const session = await stripe.checkout.sessions.retrieve(sessionId);

        const membershipId = session.metadata.membershipId;
        const paymentIntentId = session.payment_intent; // Add this line

        if (session.payment_status !== "paid") {
          return res.status(400).send({ message: "Payment not completed" });
        }

        // Update membership
        await membershipsCollection.updateOne(
          { _id: new ObjectId(membershipId) },
          {
            $set: {
              status: "active",
              expiresAt: new Date(Date.now() + 365.25 * 86_400_000),
              paymentId: paymentIntentId,
            },
          }
        );

        // Check duplicate
        const existingPayment = await paymentsCollection.findOne({
          stripePaymentIntentId: paymentIntentId,
        });

        if (existingPayment) {
          return res.send({
            success: true,
            transactionId: paymentIntentId,
            message: "Already processed",
          });
        }

        // Insert payment record
        await paymentsCollection.insertOne({
          userEmail: session.metadata.userEmail,
          amount: session.amount_total / 100,
          type: "membership",
          clubId: session.metadata.clubId,
          eventId: null,
          stripePaymentIntentId: paymentIntentId,
          status: "completed",
          createdAt: new Date(),
        });

        res.send({
          success: true,
          transactionId: paymentIntentId,
        });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Payment verification failed" });
      }
    });

    app.get("/active-memberships", verifyJWT, async (req, res) => {
      try {
        const userEmail = req.tokenEmail;

        const memberships = await membershipsCollection
          .find({ userEmail, status: "active" })
          .toArray();

        const clubIds = memberships.map((m) => new ObjectId(m.clubId));

        const clubs = await clubsCollection
          .find({ _id: { $in: clubIds } })
          .toArray();

        const combined = memberships.map((m) => {
          const club = clubs.find((c) => c._id.toString() === m.clubId);
          return {
            ...m,
            clubName: club?.clubName,
            location: club?.location,
            bannerImage: club?.bannerImage,
          };
        });

        res.send(combined);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Failed to fetch memberships" });
      }
    });

    app.get(
      "/club-members/:clubId",
      verifyJWT,
      verifyManager,
      async (req, res) => {
        try {
          const { clubId } = req.params;
          const managerEmail = req.tokenEmail;

          // Check if this club belongs to this manager
          const club = await clubsCollection.findOne({
            _id: new ObjectId(clubId),
            managerEmail,
          });

          if (!club) {
            return res.status(403).send({ message: "Unauthorized access" });
          }

          const members = await membershipsCollection
            .find({ clubId })
            .toArray();

          res.send(members);
        } catch (err) {
          res.status(500).send({ message: "Failed to fetch members" });
        }
      }
    );

    app.patch(
      "/expire-member/:id",
      verifyJWT,
      verifyManager,
      async (req, res) => {
        try {
          const { id } = req.params;

          const result = await membershipsCollection.updateOne(
            { _id: new ObjectId(id) },
            {
              $set: {
                expiresAt: new Date(Date.now() - 86400000), // yesterday
                status: "expired",
              },
            }
          );

          res.send({ success: true, result });
        } catch (err) {
          res.status(500).send({ message: "Failed to expire member" });
        }
      }
    );

    // Manager's approved club's listing.
    app.get(
      "/manager-approved/clubs",
      verifyJWT,
      verifyManager,
      async (req, res) => {
        try {
          const email = req.tokenEmail;

          const query = {
            managerEmail: email,
            status: "approved",
          };

          const clubs = await clubsCollection.find(query).toArray();

          res.send(clubs);
        } catch (err) {
          console.error("Manager clubs error:", err);
          res.status(500).send({ message: "Server error" });
        }
      }
    );

    app.post("/events", verifyJWT, verifyManager, async (req, res) => {
      try {
        const managerEmail = req.tokenEmail;
        const {
          clubId,
          title,
          description,
          eventDate,
          location,
          isPaid,
          eventFee,
          maxAttendees,
        } = req.body;

        const newEvent = {
          clubId,
          title,
          description,
          eventDate: new Date(eventDate),
          location,
          isPaid: !!isPaid,
          eventFee: isPaid ? Number(eventFee) : 0,
          maxAttendees: maxAttendees ? Number(maxAttendees) : null,
          createdAt: new Date(),
        };

        const result = await eventsCollection.insertOne(newEvent);

        res.send({
          success: true,
          eventId: result.insertedId,
          message: "Event created",
        });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error while creating event" });
      }
    });

    app.get("/manager/events", verifyJWT, verifyManager, async (req, res) => {
      try {
        const email = req.tokenEmail;
        const managerClubs = await clubsCollection
          .find({ managerEmail: email, status: "approved" })
          .toArray();

        const clubIds = managerClubs.map((c) => c._id.toString());

        const events = await eventsCollection
          .find({ clubId: { $in: clubIds } })
          .toArray();

        const merged = events.map((e) => {
          const club = managerClubs.find((c) => c._id.toString() === e.clubId);
          return {
            ...e,
            clubName: club?.clubName || "Unknown Club",
          };
        });

        res.send(merged);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Failed to fetch events" });
      }
    });

    app.delete("/events/:id", verifyJWT, verifyManager, async (req, res) => {
      try {
        const eventId = req.params.id;
        const managerEmail = req.tokenEmail;

        // Fetch the event
        const event = await eventsCollection.findOne({
          _id: new ObjectId(eventId),
        });
        if (!event) {
          return res.status(404).send({ message: "Event not found" });
        }

        // Verify manager owns the club
        const club = await clubsCollection.findOne({
          _id: new ObjectId(event.clubId),
          managerEmail: managerEmail,
          status: "approved",
        });
        if (!club) {
          return res
            .status(403)
            .send({ message: "You are not authorized to delete this event" });
        }

        // Delete the event
        await eventsCollection.deleteOne({ _id: new ObjectId(eventId) });

        res.send({ message: "Event deleted successfully" });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Failed to delete event" });
      }
    });

    app.get("/events/:id", verifyJWT, verifyManager, async (req, res) => {
      try {
        const eventId = req.params.id;
        const event = await eventsCollection.findOne({
          _id: new ObjectId(eventId),
        });
        if (!event) return res.status(404).send({ message: "Event not found" });

        const club = await clubsCollection.findOne({
          _id: new ObjectId(event.clubId),
        });
        res.send({ ...event, clubName: club?.clubName });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Failed to fetch event" });
      }
    });

    app.patch("/events/:id", verifyJWT, verifyManager, async (req, res) => {
      try {
        const managerEmail = req.tokenEmail;
        const eventId = req.params.id;
        const updateData = { ...req.body, updatedAt: new Date() };

        const event = await eventsCollection.findOne({
          _id: new ObjectId(eventId),
        });
        if (!event) return res.status(404).send({ message: "Event not found" });

        const club = await clubsCollection.findOne({
          _id: new ObjectId(event.clubId),
          managerEmail,
          status: "approved",
        });

        if (!club)
          return res
            .status(403)
            .send({ message: "Unauthorized to update this event" });

        await eventsCollection.updateOne(
          { _id: new ObjectId(eventId) },
          { $set: updateData }
        );

        const updatedEvent = await eventsCollection.findOne({
          _id: new ObjectId(eventId),
        });
        res.send(updatedEvent);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Failed to update event" });
      }
    });

    // Get all events (public)
    app.get("/all-events", async (req, res) => {
      try {
        const events = await eventsCollection.find().toArray();

        res.send(events);
      } catch (error) {
        console.error("Error fetching events:", error);
        res.status(500).send([]);
      }
    });

    app.get("/event/:id", async (req, res) => {
      const { id } = req.params;

      try {
        const event = await eventsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!event) {
          return res.status(404).send({ message: "Event not found" });
        }

        res.send(event);
      } catch (err) {
        res.status(500).send({ message: "Server error" });
      }
    });

    // Register for event (free or paid)
    app.post("/event-payment/:id/register", verifyJWT, async (req, res) => {
      try {
        const eventId = req.params.id;
        const userEmail = req.tokenEmail;

        if (!ObjectId.isValid(eventId)) {
          return res.status(400).send({ message: "Invalid event id" });
        }

        const event = await eventsCollection.findOne({
          _id: new ObjectId(eventId),
        });

        if (!event) {
          return res.status(404).send({ message: "Event not found" });
        }

        const exists = await eventRegistrationCollection.findOne({
          eventId,
          userEmail,
          status: { $ne: "cancelled" },
        });

        if (exists) {
          return res.status(400).send({
            message: "You already registered for this event",
          });
        }

        if (!event.isPaid || event.eventFee === 0) {
          const registration = {
            eventId,
            clubId: event.clubId,
            userEmail,
            status: "registered",
            paymentId: null,
            registeredAt: new Date(),
          };

          await eventRegistrationCollection.insertOne(registration);

          return res.send({
            free: true,
            message: "Registered successfully",
          });
        }

        const pendingRegistration = {
          eventId,
          clubId: event.clubId,
          userEmail,
          status: "pendingPayment",
          paymentId: null,
          registeredAt: new Date(),
        };

        const result = await eventRegistrationCollection.insertOne(
          pendingRegistration
        );

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: [
            {
              price_data: {
                currency: "usd",
                product_data: {
                  name: event.title,
                  description: event.description,
                },
                unit_amount: event.eventFee * 100,
              },
              quantity: 1,
            },
          ],
          mode: "payment",
          customer_email: userEmail,
          metadata: {
            registrationId: result.insertedId.toString(),
            eventId,
            userEmail,
          },
          success_url: `${process.env.CLIENT_DOMAIN}/event-payment-success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.CLIENT_DOMAIN}/event/${eventId}`,
        });

        res.send({
          free: false,
          checkoutUrl: session.url,
        });
      } catch (err) {
        console.error("EVENT REGISTRATION ERROR:", err);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    app.post("/event-payment-success", async (req, res) => {
      try {
        const { sessionId } = req.body;

        const session = await stripe.checkout.sessions.retrieve(sessionId);

        const registrationId = session.metadata.registrationId;
        const paymentIntentId = session.payment_intent; // Define it

        if (session.payment_status !== "paid") {
          return res.status(400).send({ message: "Payment not completed" });
        }

        // Update registration
        await eventRegistrationCollection.updateOne(
          { _id: new ObjectId(registrationId) },
          {
            $set: {
              status: "registered",
              paymentId: paymentIntentId,
            },
          }
        );

        // Prevent duplicate payment record
        const existingPayment = await paymentsCollection.findOne({
          stripePaymentIntentId: paymentIntentId,
        });

        if (existingPayment) {
          return res.send({
            success: true,
            transactionId: paymentIntentId,
            message: "Already processed",
          });
        }

        // Insert payment record
        await paymentsCollection.insertOne({
          userEmail: session.metadata.userEmail,
          amount: session.amount_total / 100,
          type: "event",
          clubId: null,
          eventId: session.metadata.eventId,
          stripePaymentIntentId: paymentIntentId,
          status: "completed",
          createdAt: new Date(),
        });

        res.send({
          success: true,
          transactionId: paymentIntentId,
        });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Payment verification failed" });
      }
    });

    // Get all events registered by the logged-in user with club & event details
    app.get("/my-registered-events", verifyJWT, async (req, res) => {
      try {
        const userEmail = req.tokenEmail;

        const registrations = await eventRegistrationCollection
          .find({ userEmail, status: { $ne: "cancelled" } })
          .toArray();

        if (registrations.length === 0) return res.send([]);

        const eventIds = registrations.map((r) => new ObjectId(r.eventId));
        const clubIds = registrations.map((r) => new ObjectId(r.clubId));

        const [events, clubs] = await Promise.all([
          eventsCollection.find({ _id: { $in: eventIds } }).toArray(),
          clubsCollection.find({ _id: { $in: clubIds } }).toArray(),
        ]);

        const results = registrations.map((reg) => {
          const event = events.find((e) => e._id.toString() === reg.eventId);
          const club = clubs.find((c) => c._id.toString() === reg.clubId);

          return {
            registrationId: reg._id,
            status: reg.status,
            registeredAt: reg.registeredAt,
            eventTitle: event?.title || "Unknown Event",
            eventDate: event?.eventDate,
            eventLocation: event?.location,
            clubName: club?.clubName || "Unknown Club",
            clubBanner: club?.bannerImage,
          };
        });
        // console.log(results);

        res.send(results);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });

    // Get user's payment history
    app.get("/my-payments", verifyJWT, async (req, res) => {
      try {
        const userEmail = req.tokenEmail;

        const payments = await paymentsCollection
          .find({ userEmail })
          .sort({ createdAt: -1 })
          .toArray();

        const clubIds = payments
          .filter((p) => p.clubId)
          .map((p) => new ObjectId(p.clubId));

        const clubs =
          clubIds.length > 0
            ? await clubsCollection.find({ _id: { $in: clubIds } }).toArray()
            : [];

        const result = payments.map((payment) => {
          const club = clubs.find((c) => c._id.toString() === payment.clubId);
          return {
            amount: payment.amount,
            type: payment.type,
            clubName:
              payment.type === "membership"
                ? club?.clubName || "Unknown Club"
                : null,
            eventName: payment.type === "event" ? "Event Fee" : null,
            status: payment.status,
            date: payment.createdAt,
            transactionId: payment.stripePaymentIntentId,
          };
        });

        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Failed to fetch payments" });
      }
    });

    // Get registered users for a specific event (Manager only)
    app.get(
      "/manager/events/:eventId/registrations",
      verifyJWT,
      verifyManager,
      async (req, res) => {
        try {
          const { eventId } = req.params;
          const managerEmail = req.tokenEmail;

          // Verify manager owns the event's club
          const event = await eventsCollection.findOne({
            _id: new ObjectId(eventId),
          });
          if (!event)
            return res.status(404).send({ message: "Event not found" });

          const club = await clubsCollection.findOne({
            _id: new ObjectId(event.clubId),
            managerEmail,
            status: "approved",
          });
          if (!club) return res.status(403).send({ message: "Unauthorized" });

          const registrations = await eventRegistrationCollection
            .find({ eventId: eventId.toString() })
            .sort({ registeredAt: -1 })
            .toArray();

          res.send(registrations);
        } catch (err) {
          console.error(err);
          res.status(500).send({ message: "Server error" });
        }
      }
    );

    // Admin: All payments
    app.get("/admin/payments", verifyJWT, verifyAdmin, async (req, res) => {
      try {
        const payments = await paymentsCollection
          .find({})
          .sort({ createdAt: -1 })
          .toArray();

        const clubIds = payments
          .filter((p) => p.clubId)
          .map((p) => new ObjectId(p.clubId));

        const clubs =
          clubIds.length > 0
            ? await clubsCollection.find({ _id: { $in: clubIds } }).toArray()
            : [];

        const result = payments.map((p) => ({
          userEmail: p.userEmail,
          amount: p.amount,
          type: p.type,
          clubName:
            p.type === "membership"
              ? clubs.find((c) => c._id.toString() === p.clubId)?.clubName ||
                "Unknown Club"
              : null,
          date: p.createdAt,
        }));

        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Nothing
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from Server..");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
