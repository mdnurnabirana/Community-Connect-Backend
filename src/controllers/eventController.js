const { collections, ObjectId } = require("../config/db");
const stripe = require("../config/stripe");

const {
  eventsCollection,
  clubsCollection,
  membershipsCollection,
  eventRegistrationCollection,
  paymentsCollection,
  usersCollection,
} = collections;

async function createEvent(req, res) {
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
}

async function getManagerEvents(req, res) {
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
}

async function deleteEvent(req, res) {
  try {
    const eventId = req.params.id;
    const managerEmail = req.tokenEmail;

    const event = await eventsCollection.findOne({
      _id: new ObjectId(eventId),
    });
    if (!event) {
      return res.status(404).send({ message: "Event not found" });
    }

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

    await eventsCollection.deleteOne({ _id: new ObjectId(eventId) });

    res.send({ message: "Event deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to delete event" });
  }
}

async function getManagerEventById(req, res) {
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
}

async function updateEvent(req, res) {
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
}

async function getAllEvents(req, res) {
  try {
    const { search, category } = req.query;

    let query = {};

    if (search) {
      query.title = { $regex: search, $options: "i" };
    }

    if (category) {
      query.category = category;
    }

    const events = await eventsCollection.find(query).toArray();
    res.send(events);
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).send([]);
  }
}

async function getEventByIdPublic(req, res) {
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
}

async function getEventRegistrationCheck(req, res) {
  try {
    const eventId = req.params.id;
    const userEmail = req.tokenEmail;
    if (!ObjectId.isValid(eventId))
      return res.status(400).send({ message: "Invalid event ID" });
    const registration = await eventRegistrationCollection.findOne({
      eventId,
      userEmail,
    });
    if (!registration) return res.status(200).send({ registered: false });
    return res.status(200).send({
      registered: registration.status === "registered",
      status: registration.status,
      expiresAt: registration.expiresAt || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Internal server error" });
  }
}

async function registerForEvent(req, res) {
  try {
    const eventId = req.params.id;
    const userEmail = req.tokenEmail;
    if (!ObjectId.isValid(eventId))
      return res.status(400).send({ message: "Invalid event ID" });
    const user = await usersCollection.findOne({ email: userEmail });
    if (!user || user.role !== "member")
      return res.status(403).send({ message: "Only members can register" });
    const event = await eventsCollection.findOne({
      _id: new ObjectId(eventId),
    });
    if (!event) return res.status(404).send({ message: "Event not found" });
    const membership = await membershipsCollection.findOne({
      userEmail,
      clubId: event.clubId,
      status: "active",
    });
    if (!membership)
      return res
        .status(403)
        .send({ message: "Active club membership required" });

    const existingReg = await eventRegistrationCollection.findOne({
      eventId,
      userEmail,
    });

    if (existingReg) {
      if (existingReg.status === "registered")
        return res.status(400).send({ message: "Already registered" });
      if (
        existingReg.status === "pendingPayment" &&
        existingReg.expiresAt > new Date()
      ) {
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
            registrationId: existingReg._id.toString(),
            eventId,
            userEmail,
          },
          success_url: `${process.env.CLIENT_DOMAIN}/event-payment-success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.CLIENT_DOMAIN}/event/${eventId}`,
        });
        return res.send({
          free: false,
          checkoutUrl: session.url,
          resumed: true,
        });
      }
      if (existingReg.status === "pendingPayment")
        await eventRegistrationCollection.deleteOne({
          _id: existingReg._id,
        });
    }

    if (!event.isPaid || event.eventFee === 0) {
      await eventRegistrationCollection.insertOne({
        eventId,
        clubId: event.clubId,
        userEmail,
        status: "registered",
        paymentId: null,
        registeredAt: new Date(),
      });
      return res.send({
        free: true,
        message: "Successfully registered for free event",
      });
    }

    const pendingRegistration = {
      eventId,
      clubId: event.clubId,
      userEmail,
      status: "pendingPayment",
      registeredAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      paymentId: null,
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

    res.send({ free: false, checkoutUrl: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Internal server error" });
  }
}

async function handleEventPaymentSuccess(req, res) {
  try {
    const { sessionId } = req.body;
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid")
      return res.status(400).send({ message: "Payment not completed" });

    const { eventId, userEmail } = session.metadata;
    const paymentIntentId = session.payment_intent;
    const existingPayment = await paymentsCollection.findOne({
      stripePaymentIntentId: paymentIntentId,
    });
    if (existingPayment)
      return res.send({
        success: true,
        message: "Payment already processed",
      });

    await paymentsCollection.insertOne({
      userEmail,
      amount: session.amount_total / 100,
      type: "event",
      clubId: null,
      eventId,
      stripePaymentIntentId: paymentIntentId,
      status: "completed",
      createdAt: new Date(),
    });
    await eventRegistrationCollection.updateOne(
      { eventId, userEmail, status: "pendingPayment" },
      {
        $set: {
          status: "registered",
          paymentId: paymentIntentId,
          expiresAt: null,
        },
      }
    );

    res.send({
      success: true,
      transactionId: paymentIntentId,
      message: "Event registration successful",
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Payment verification failed" });
  }
}

async function getMyRegisteredEvents(req, res) {
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

    res.send(results);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Server error" });
  }
}

async function getManagerEventRegistrations(req, res) {
  try {
    const { eventId } = req.params;
    const managerEmail = req.tokenEmail;

    const event = await eventsCollection.findOne({
      _id: new ObjectId(eventId),
    });
    if (!event) return res.status(404).send({ message: "Event not found" });

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

module.exports = {
  createEvent,
  getManagerEvents,
  deleteEvent,
  getManagerEventById,
  updateEvent,
  getAllEvents,
  getEventByIdPublic,
  getEventRegistrationCheck,
  registerForEvent,
  handleEventPaymentSuccess,
  getMyRegisteredEvents,
  getManagerEventRegistrations,
};

