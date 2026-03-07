const { collections, ObjectId } = require("../config/db");
const stripe = require("../config/stripe");

const {
  clubsCollection,
  membershipsCollection,
  paymentsCollection,
} = collections;

async function joinClub(req, res) {
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
      clubId,
      userEmail,
    });

    if (existingMembership?.status === "active") {
      return res.status(400).send({
        message: "You already have an active membership",
      });
    }

    if (
      existingMembership?.status === "pendingPayment" &&
      existingMembership.expiresAt &&
      existingMembership.expiresAt > new Date()
    ) {
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
          membershipId: existingMembership._id.toString(),
          clubId,
          userEmail,
        },
        success_url: `${process.env.CLIENT_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_DOMAIN}/club/${clubId}`,
      });

      return res.send({
        free: false,
        checkoutUrl: session.url,
        resumed: true,
      });
    }

    if (existingMembership) {
      await membershipsCollection.deleteOne({
        _id: existingMembership._id,
      });
    }

    if (club.membershipFee === 0) {
      await membershipsCollection.insertOne({
        userEmail,
        clubId,
        status: "active",
        joinedAt: new Date(),
        expiresAt: null,
        paymentId: null,
      });

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
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
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
        clubId,
        userEmail,
      },
      success_url: `${process.env.CLIENT_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_DOMAIN}/club/${clubId}`,
    });

    res.send({
      free: false,
      checkoutUrl: session.url,
    });
  } catch (err) {
    console.error("JOIN CLUB ERROR:", err);
    res.status(500).send({ message: "Internal server error" });
  }
}

async function handleMembershipPaymentSuccess(req, res) {
  try {
    const { sessionId } = req.body;

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const membershipId = session.metadata.membershipId;
    const paymentIntentId = session.payment_intent;

    if (session.payment_status !== "paid") {
      return res.status(400).send({ message: "Payment not completed" });
    }

    await membershipsCollection.deleteMany({
      userEmail: session.metadata.userEmail,
      clubId: session.metadata.clubId,
      status: "expired",
    });

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
}

async function getActiveMemberships(req, res) {
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
}

async function getMembershipCheckForClub(req, res) {
  try {
    const clubId = req.params.clubId;
    const userEmail = req.tokenEmail;
    const membership = await membershipsCollection.findOne({
      userEmail,
      clubId,
      status: "active",
    });
    res.send({ hasActive: !!membership });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Internal server error" });
  }
}

async function expireMember(req, res) {
  try {
    const { id } = req.params;

    const result = await membershipsCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          expiresAt: new Date(Date.now() - 86400000),
          status: "expired",
        },
      }
    );

    res.send({ success: true, result });
  } catch (err) {
    res.status(500).send({ message: "Failed to expire member" });
  }
}

module.exports = {
  joinClub,
  handleMembershipPaymentSuccess,
  getActiveMemberships,
  getMembershipCheckForClub,
  expireMember,
};

