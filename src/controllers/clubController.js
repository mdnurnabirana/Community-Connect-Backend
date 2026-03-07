const { collections, ObjectId } = require("../config/db");

const {
  clubsCollection,
  membershipsCollection,
  eventsCollection,
} = collections;

async function createClub(req, res) {
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
}

async function getManagerClubs(req, res) {
  try {
    const email = req.tokenEmail;

    const clubs = await clubsCollection
      .find({ managerEmail: email })
      .toArray();

    res.send(clubs);
  } catch (err) {
    res.status(500).send({ message: "Server error" });
  }
}

async function getManagerClubById(req, res) {
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

async function updateManagerClub(req, res) {
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

async function deleteManagerClub(req, res) {
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

async function getAdminClubs(req, res) {
  try {
    const clubs = await clubsCollection.find({}).toArray();
    if (!clubs.length) return res.send([]);

    const clubIds = clubs.map((c) => c._id.toString());

    const membersAgg = await membershipsCollection
      .aggregate([
        { $match: { clubId: { $in: clubIds } } },
        { $group: { _id: "$clubId", count: { $sum: 1 } } },
      ])
      .toArray();

    const eventsAgg = await eventsCollection
      .aggregate([
        { $match: { clubId: { $in: clubIds } } },
        { $group: { _id: "$clubId", count: { $sum: 1 } } },
      ])
      .toArray();

    const membersMap = {};
    membersAgg.forEach((m) => {
      membersMap[m._id] = m.count;
    });

    const eventsMap = {};
    eventsAgg.forEach((e) => {
      eventsMap[e._id] = e.count;
    });

    const result = clubs.map((club) => ({
      ...club,
      membersCount: membersMap[club._id.toString()] || 0,
      eventsCount: eventsMap[club._id.toString()] || 0,
    }));

    res.send(result);
  } catch (err) {
    console.error("ADMIN CLUB STATS ERROR:", err);
    res.status(500).send({ message: "Server error" });
  }
}

async function updateAdminClubStatus(req, res) {
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

async function getApprovedClubs(req, res) {
  try {
    const { search = "", category, sort } = req.query;

    const query = { status: "approved" };

    if (search) {
      query.clubName = { $regex: search, $options: "i" };
    }

    if (category) {
      query.category = category;
    }

    let sortOption = { createdAt: -1 };

    if (sort === "oldest") sortOption = { createdAt: 1 };
    else if (sort === "highestFee") sortOption = { membershipFee: -1 };
    else if (sort === "lowestFee") sortOption = { membershipFee: 1 };

    const approvedClubs = await clubsCollection
      .find(query)
      .sort(sortOption)
      .toArray();

    res.send(approvedClubs);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Server error" });
  }
}

async function getClubById(req, res) {
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
}

async function getClubMembers(req, res) {
  try {
    const { clubId } = req.params;
    const managerEmail = req.tokenEmail;

    const club = await clubsCollection.findOne({
      _id: new ObjectId(clubId),
      managerEmail,
    });

    if (!club) {
      return res.status(403).send({ message: "Unauthorized access" });
    }

    const members = await membershipsCollection.find({ clubId }).toArray();

    res.send(members);
  } catch (err) {
    res.status(500).send({ message: "Failed to fetch members" });
  }
}

async function getManagerApprovedClubs(req, res) {
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

async function getFeaturedClubs(req, res) {
  try {
    const limit = 8;

    const approvedClubs = await clubsCollection
      .find({ status: "approved" })
      .toArray();

    if (!approvedClubs.length) return res.send([]);

    const clubIds = approvedClubs.map((c) => c._id.toString());

    const membersAgg = await membershipsCollection
      .aggregate([
        { $match: { clubId: { $in: clubIds } } },
        { $group: { _id: "$clubId", membersCount: { $sum: 1 } } },
      ])
      .toArray();

    const membersMap = {};
    membersAgg.forEach((m) => {
      membersMap[m._id] = m.membersCount;
    });

    const clubsWithMembers = approvedClubs.map((club) => ({
      ...club,
      membersCount: membersMap[club._id.toString()] || 0,
    }));

    clubsWithMembers.sort((a, b) => {
      if (b.membersCount !== a.membersCount)
        return b.membersCount - a.membersCount;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.send(clubsWithMembers.slice(0, limit));
  } catch (err) {
    console.error("FEATURED CLUBS ERROR:", err);
    res
      .status(500)
      .send({ message: "Server error fetching featured clubs" });
  }
}

module.exports = {
  createClub,
  getManagerClubs,
  getManagerClubById,
  updateManagerClub,
  deleteManagerClub,
  getAdminClubs,
  updateAdminClubStatus,
  getApprovedClubs,
  getClubById,
  getClubMembers,
  getManagerApprovedClubs,
  getFeaturedClubs,
};

