require("dotenv").config();
const express = require("express");
const cors = require("cors");
const port = process.env.PORT || 3000;
const admin = require("firebase-admin");
const serviceAccount = require("./firebaseAdminSDK.json");
const { ObjectId } = require("mongodb");

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

// middleware
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

    const db = client.db("communityDB");
    const usersCollection = db.collection("users");
    const clubsCollection = db.collection("clubs");

    // role middlewares
    const verifyAdmin = async (req, res, next) => {
      const email = req.tokenEmail;
      const user = await usersCollection.findOne({ email });
      if (user?.role !== "admin")
        return res
          .status(403)
          .send({ message: "Admin only Actions!", role: user?.role });

      next();
    };

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

    // Get Single Club by ID (Only Own Club)
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