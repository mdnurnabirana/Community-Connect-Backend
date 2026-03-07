const { collections, ObjectId } = require("../config/db");

const { paymentsCollection, clubsCollection } = collections;

async function getMyPayments(req, res) {
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
}

async function getAdminPayments(req, res) {
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
}

module.exports = {
  getMyPayments,
  getAdminPayments,
};

