require("dotenv").config();
const app = require("./src/app");
const { connectDB } = require("./src/config/db");

const port = process.env.PORT || 3000;

async function startServer() {
  try {
    await connectDB();
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

startServer();
