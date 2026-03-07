const express = require("express");
const cors = require("cors");

const userRoutes = require("./routes/userRoutes");
const clubRoutes = require("./routes/clubRoutes");
const eventRoutes = require("./routes/eventRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello from Server..");
});

app.use(userRoutes);
app.use(clubRoutes);
app.use(eventRoutes);
app.use(paymentRoutes);
app.use(dashboardRoutes);

module.exports = app;

