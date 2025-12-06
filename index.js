require("dotenv").config();
const express = require("express");
const cors = require("cors");
const port = process.env.PORT || 3000;

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

async function run() {
  try {
    await client.connect();

    const db = client.db("communityDB");
    const usersCollection = db.collection("users");

    // Save user into collection
    app.post("/user", async (req, res) => {
      try {
        const { email, ...rest } = req.body;

        if (!email) {
          return res.status(400).send({ message: "Email is required" });
        }

        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) {
          return res.status(409).send({ message: "User already exists" });
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