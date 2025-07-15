const express = require("express");
const cors = require("cors");
require("dotenv").config();
const cookieParser = require("cookie-parser");
const app = express();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// Middleware
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// Port
const port = process.env.PORT || 5000;

// MongoDB Setup
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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
    const DonationRequests = client.db("DonationDB").collection("Donations");


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
        const { name, email, password, bloodGroup, district, upazila, avatar } =
          req.body;

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

        //JWT creation
        const token = jwt.sign({ email }, process.env.JWT_SECRET, {
          expiresIn: "7d",
        });

        res
          .cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000,
          })
          .status(201)
          .json({
            message: "User registered successfully",
            user: newUser,
          });
      } catch (error) {
        res
          .status(500)
          .json({ message: "Registration failed", error: error.message });
      }
    });

    //user login
    app.post("/api/login", async (req, res) => {
      try {
        const { email, password } = req.body;

        const user = await Users.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch)
          return res.status(401).json({ message: "Invalid password" });

        const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, {
          expiresIn: "7d",
        });

        res
          .cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000,
          })
          .status(200)
          .json({ message: "Login successful", user });
      } catch (err) {
        res.status(500).json({ message: "Login failed", error: err.message });
      }
    });

    //Logout user
    app.post("/api/logout", (req, res) => {
      res.clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });
      res.status(200).json({ message: "Logout successful" });
    });

    //Check if user is logged in
    app.get("/api/me", async (req, res) => {
      try {
        const token = req.cookies.token;
        if (!token) return res.status(401).json({ message: "Unauthorized" });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await Users.findOne({ email: decoded.email });

        if (!user) return res.status(404).json({ message: "User not found" });

        res.status(200).json({ user });
      } catch (err) {
        res.status(401).json({ message: "Unauthorized", error: err.message });
      }
    });
    // PATCH /users/:id
    app.patch("/users/:id", async (req, res) => {
      const { id } = req.params;
      const updatedData = req.body;
      const result = await Users.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedData }
      );
      res.send(result);
    });

    // Create Donation Request
app.post("/donation-requests", async (req, res) => {
  try {
    const {
      requesterName,
      requesterEmail,
      recipientName,
      district,
      upazila,
      hospitalName,
      address,
      bloodGroup,
      donationDate,
      donationTime,
      requestMessage,
    } = req.body;

    if (
      !requesterName ||
      !requesterEmail ||
      !recipientName ||
      !district ||
      !upazila ||
      !hospitalName ||
      !address ||
      !bloodGroup ||
      !donationDate ||
      !donationTime ||
      !requestMessage
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const newRequest = {
      requesterName,
      requesterEmail,
      recipientName,
      district,
      upazila,
      hospitalName,
      address,
      bloodGroup,
      donationDate,
      donationTime,
      requestMessage,
      status: "pending",
      createdAt: new Date(),
    };

    const result = await DonationRequests.insertOne(newRequest);

    res.status(201).json({
      message: "Donation request created successfully",
      requestId: result.insertedId,
    });
  } catch (err) {
    console.error("Donation Request Error:", err);
    res.status(500).json({ message: "Failed to create donation request" });
  }
});
// Get all donation requests
app.get("/donation-requests", async (req, res) => {
  const requests = await DonationRequests.find().sort({ createdAt: -1 }).toArray();
  res.send(requests);
});

// GET single donation request by ID
app.get("/donation-requests/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const request = await DonationRequests.findOne({ _id: new ObjectId(id) });

    if (!request) {
      return res.status(404).json({ message: "Donation request not found" });
    }

    res.status(200).json(request);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch donation request", error: error.message });
  }
});


// PATCH donation request by ID
app.patch("/donation-requests/:id", async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;



  try {
    delete updateData._id; 
    const result = await DonationRequests.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Donation request not found" });
    }

    res.status(200).json({ message: "Donation request updated", result });
  } catch (err) {
    res.status(500).json({ message: "Update failed", error: err.message });
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
