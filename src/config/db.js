const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const uri = process.env.Mongo_URI;

if (!uri) {
  throw new Error("Mongo_URI environment variable is not set");
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const db = client.db("communityDB");

const usersCollection = db.collection("users");
const clubsCollection = db.collection("clubs");
const membershipsCollection = db.collection("memberships");
const eventsCollection = db.collection("events");
const eventRegistrationCollection = db.collection("eventRegistrations");
const paymentsCollection = db.collection("payments");

async function connectDB() {
  try {
    await client.connect();
    await db.command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } catch (err) {
    console.error("MongoDB connection error:", err);
    throw err;
  }
}

module.exports = {
  client,
  db,
  ObjectId,
  connectDB,
  collections: {
    usersCollection,
    clubsCollection,
    membershipsCollection,
    eventsCollection,
    eventRegistrationCollection,
    paymentsCollection,
  },
};

