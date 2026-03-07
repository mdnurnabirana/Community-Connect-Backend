const { collections, ObjectId } = require("../config/db");

const {
  usersCollection,
  clubsCollection,
  membershipsCollection,
  eventsCollection,
  eventRegistrationCollection,
  paymentsCollection,
} = collections;

async function getMemberOverview(req, res) {
  try {
    const userEmail = req.tokenEmail;

    const memberships = await membershipsCollection
      .find({ userEmail, status: "active" })
      .toArray();

    const totalClubsJoined = memberships.length;

    const registrations = await eventRegistrationCollection
      .find({ userEmail, status: "registered" })
      .toArray();

    const totalEventsRegistered = registrations.length;

    const now = new Date();
    const eventIds = registrations.map((r) => new ObjectId(r.eventId));
    const upcomingEvents = await eventsCollection
      .find({
        _id: { $in: eventIds },
        eventDate: { $gt: now },
      })
      .sort({ eventDate: 1 })
      .limit(5)
      .toArray();

    const clubIds = upcomingEvents.map((e) => new ObjectId(e.clubId));
    const clubs = await clubsCollection
      .find({ _id: { $in: clubIds } })
      .toArray();

    const upcomingWithClub = upcomingEvents.map((e) => {
      const club = clubs.find((c) => c._id.toString() === e.clubId);
      return {
        title: e.title,
        eventDate: e.eventDate,
        location: e.location,
        clubName: club?.clubName || "Unknown Club",
      };
    });

    res.send({
      totalClubsJoined,
      totalEventsRegistered,
      upcomingEvents: upcomingWithClub,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Server error" });
  }
}

async function getManagerOverview(req, res) {
  try {
    const managerEmail = req.tokenEmail;

    const clubs = await clubsCollection
      .find({ managerEmail, status: "approved" })
      .toArray();

    const clubIds = clubs.map((c) => c._id.toString());

    const events = await eventsCollection
      .find({ clubId: { $in: clubIds } })
      .toArray();

    const eventIds = events.map((e) => e._id.toString());

    const [membershipsCount, eventsCount, paymentsAgg] = await Promise.all([
      membershipsCollection.countDocuments({
        clubId: { $in: clubIds },
        status: "active",
      }),
      eventsCollection.countDocuments({ clubId: { $in: clubIds } }),
      paymentsCollection
        .aggregate([
          {
            $match: {
              status: "completed",
              $or: [
                { clubId: { $in: clubIds } },
                { eventId: { $in: eventIds } },
              ],
            },
          },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ])
        .toArray(),
    ]);

    res.send({
      totalClubs: clubs.length,
      totalMembers: membershipsCount,
      totalEvents: eventsCount,
      totalRevenue: paymentsAgg[0]?.total || 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Server error" });
  }
}

async function getManagerMembersOverTime(req, res) {
  try {
    const managerEmail = req.tokenEmail;

    const clubs = await clubsCollection
      .find({ managerEmail, status: "approved" })
      .toArray();

    const clubIds = clubs.map((c) => c._id.toString());

    const result = await membershipsCollection
      .aggregate([
        {
          $match: {
            clubId: { $in: clubIds },
            status: "active",
          },
        },
        {
          $group: {
            _id: { $substr: ["$createdAt", 0, 7] },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray();

    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send([]);
  }
}

async function getManagerRevenueOverTime(req, res) {
  try {
    const managerEmail = req.tokenEmail;

    const clubs = await clubsCollection
      .find({ managerEmail, status: "approved" })
      .toArray();

    const clubIds = clubs.map((c) => c._id.toString());

    const result = await paymentsCollection
      .aggregate([
        {
          $match: {
            clubId: { $in: clubIds },
            type: "membership",
            status: "completed",
          },
        },
        {
          $group: {
            _id: { $substr: ["$createdAt", 0, 7] },
            total: { $sum: "$amount" },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray();

    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send([]);
  }
}

async function getAdminOverview(req, res) {
  try {
    const [
      totalUsers,
      clubsStats,
      totalMemberships,
      totalEvents,
      totalPayments,
    ] = await Promise.all([
      usersCollection.countDocuments({}),
      clubsCollection
        .aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }])
        .toArray(),
      membershipsCollection.countDocuments({ status: "active" }),
      eventsCollection.countDocuments({}),
      paymentsCollection
        .aggregate([
          { $match: { status: "completed" } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ])
        .toArray(),
    ]);

    const clubs = {
      pending: clubsStats.find((c) => c._id === "pending")?.count || 0,
      approved: clubsStats.find((c) => c._id === "approved")?.count || 0,
      rejected: clubsStats.find((c) => c._id === "rejected")?.count || 0,
      total: clubsStats.reduce((sum, c) => sum + c.count, 0),
    };

    res.send({
      totalUsers,
      clubs,
      totalMemberships,
      totalEvents,
      totalRevenue: totalPayments[0]?.total || 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Server error" });
  }
}

async function getAdminUsersOverTime(req, res) {
  try {
    const usersOverTime = await usersCollection
      .aggregate([
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m", date: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray();

    res.send(usersOverTime);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Server error" });
  }
}

async function getAdminRevenueOverTime(req, res) {
  try {
    const revenueOverTime = await paymentsCollection
      .aggregate([
        { $match: { status: "completed" } },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m", date: "$createdAt" },
            },
            total: { $sum: "$amount" },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray();

    res.send(revenueOverTime);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Server error" });
  }
}

module.exports = {
  getMemberOverview,
  getManagerOverview,
  getManagerMembersOverTime,
  getManagerRevenueOverTime,
  getAdminOverview,
  getAdminUsersOverTime,
  getAdminRevenueOverTime,
};


