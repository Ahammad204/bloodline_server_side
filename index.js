const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Port
const port = process.env.PORT || 5000;

// MongoDB Setup
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = process.env.URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("✅ Connected to MongoDB");
    
    // You can now define your routes that use the database below this line
    // Example: const db = client.db("bloodline");

  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
  }
}

run().catch(console.dir);

// Root route
app.get("/", (req, res) => {
  res.send("🚀 BloodLine BD Server is Running...");
});

// Start the server
app.listen(port, () => {
  console.log(`🚀 Server is running on port ${port}`);
});
