require('dotenv').config()
const express = require('express')
const cors = require('cors')
const port = process.env.PORT || 3000

const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = process.env.Mongo_URI

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const app = express()
app.use(cors())
app.use(express.json())

async function run() {
  try {
    const db = client.db('communityDB');
    const usersCollection = db.collection('users')

    // Save user into collection
    app.post('/user', async (req, res) => {
        const userData = req.body;
        userData.created_at = new Date().toISOString()
        userData.last_loggedIn = new Date().toISOString()

        const result = await usersCollection.insertOne(userData)
        res.send(result)
    })

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
  } finally {
    // Nothing
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello from Server..')
})

app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})