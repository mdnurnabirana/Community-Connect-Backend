const { collections, ObjectId } = require("../config/db");

const { usersCollection } = collections;

async function createUser(req, res) {
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
}

async function updateUserRole(req, res) {
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
}

async function getAllUsers(req, res) {
  const result = await usersCollection.find().toArray();
  res.send(result);
}

async function getUserRole(req, res) {
  const result = await usersCollection.findOne({ email: req.tokenEmail });
  res.send({ role: result?.role });
}

async function updateUserProfile(req, res) {
  try {
    const userEmail = req.tokenEmail;
    const { name, image } = req.body;

    if (!userEmail)
      return res.status(401).send({ message: "Invalid token email" });
    if (!name && !image)
      return res.status(400).send({ message: "Nothing to update" });

    const updateFields = {};
    if (name) updateFields.name = name;
    if (image) updateFields.photoURL = image;

    const result = await usersCollection.updateOne(
      { email: userEmail },
      { $set: updateFields }
    );

    if (result.matchedCount === 0)
      return res.status(404).send({ message: "User not found" });

    res.send({
      success: true,
      message: "Profile updated",
      data: updateFields,
    });
  } catch (err) {
    res.status(500).send({ message: "Server error" });
  }
}

module.exports = {
  createUser,
  updateUserRole,
  getAllUsers,
  getUserRole,
  updateUserProfile,
};

