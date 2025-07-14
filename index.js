const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

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
    console.log(" Connected to MongoDB");

    
    const Districts = client.db("GeocodeDB").collection("Districts");
    const Divisions = client.db("GeocodeDB").collection("Divisions");
    const Upazilas = client.db("GeocodeDB").collection("Upazilas");
    const Unions = client.db("GeocodeDB").collection("Unions");
    const Users = client.db("UsersDB").collection("Users");


    app.get("/geocode/divisions", async (req, res) => {
      const divisions = await Divisions.find().toArray();
      res.send(divisions);
    });

    app.get("/geocode/districts", async (req, res) => {
      const districts = await Districts.find().toArray();
      res.send(districts);
    });

    app.get("/geocode/upazilas", async (req, res) => {
      const upazilas = await Upazilas.find().toArray();
      res.send(upazilas);
    });

    app.get("/geocode/unions", async (req, res) => {
      const unions = await Unions.find().toArray();
      res.send(unions);
    });

    //Upload user to Database
    app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password, bloodGroup, district, upazila, avatar } = req.body;

    const existingUser = await Users.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      name,
      email,
      password: hashedPassword,
      bloodGroup,
      district,
      upazila,
      avatar,
      role: "donor",
      status: "active",
      createdAt: new Date(),
    };

    const result = await Users.insertOne(newUser);

    // Optional: JWT creation
    // const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.status(201).json({
      message: "User registered successfully",
      userId: result.insertedId,
      // token,
    });
  } catch (error) {
    res.status(500).json({ message: "Registration failed", error: error.message });
  }
});


  } catch (error) {
    console.error(" MongoDB connection failed:", error);
  }
}

run().catch(console.dir);

// Root route
app.get("/", (req, res) => {
  res.send(" BloodLine  Server is Running...");
});

// Start the server
app.listen(port, () => {
  console.log(` Server is running on port ${port}`);
});
