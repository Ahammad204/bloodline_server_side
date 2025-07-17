const express = require("express");
const cors = require("cors");
require("dotenv").config();
const cookieParser = require("cookie-parser");
const app = express();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Middleware
app.use(
  cors({
    // origin: "http://localhost:5173",
    origin: "https://bloodlines.netlify.app",
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

const verifyToken = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized: No token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ message: "Forbidden: Invalid token" });
  }
};

// const verifyAdmin = async (req, res, next) => {
//   const email = req.user?.email;
//   const user = await user.findOne({ email });
//   if (user?.role !== "admin") {
//     return res.status(403).json({ message: "Forbidden: Admins only" });
//   }
//   next();
// };

async function run() {
  try {
    // await client.connect();
    // await client.db("admin").command({ ping: 1 });
    console.log(" Connected to MongoDB");

    const Districts = client.db("GeocodeDB").collection("Districts");
    const Divisions = client.db("GeocodeDB").collection("Divisions");
    const Upazilas = client.db("GeocodeDB").collection("Upazilas");
    const Unions = client.db("GeocodeDB").collection("Unions");
    const Users = client.db("UsersDB").collection("Users");
    const DonationRequests = client.db("DonationDB").collection("Donations");
    const Blogs = client.db("BlogDB").collection("Blogs");
    const Funds = client.db("FundDB").collection("Funds");

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

        res.cookie("token", token, {
          httpOnly: true,
          secure: true, //  required for cross-site cookies
          sameSite: "none", //  required for cross-site cookies
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });
            res.status(200).json({ message: "Register successful", result });
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

        res.cookie("token", token, {
          httpOnly: true,
          secure: true, //  required for cross-site cookies
          sameSite: "none", //  required for cross-site cookies
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });
            res.status(200).json({ message: "Login successful", user });
      } catch (err) {
        res.status(500).json({ message: "Login failed", error: err.message });
      }
    });

    //Logout user
app.post("/api/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
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
    // app.patch("/users/:id", async (req, res) => {
    //   const { id } = req.params;
    //   const updatedData = req.body;
    //   const result = await Users.updateOne(
    //     { _id: new ObjectId(id) },
    //     { $set: updatedData }
    //   );
    //   res.send(result);
    // });

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
    app.get("/donation-requests",  async (req, res) => {
      const requests = await DonationRequests.find()
        .sort({ createdAt: -1 })
        .toArray();
      res.send(requests);
    });
    // Get all Users
    app.get("/users", async (req, res) => {
      const requests = await Users.find().sort({ createdAt: -1 }).toArray();
      res.send(requests);
    });
    // GET: Get single user by ID
    app.get("/users/:id", async (req, res) => {
      const { id } = req.params;
      try {
        const user = await Users.findOne({ _id: new ObjectId(id) });
        if (!user) return res.status(404).json({ message: "user not found" });
        res.status(200).json(user);
      } catch (err) {
        res
          .status(500)
          .json({ message: "Failed to fetch user", error: err.message });
        console.log(err);
      }
    });
    //Update user
    app.patch("/users/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      const updatedData = req.body;
      const result = await Users.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedData }
      );
      res.send(result);
    });

    // GET single donation request by ID
    app.get("/donation-requests/:id", async (req, res) => {
      const { id } = req.params;

      try {
        const request = await DonationRequests.findOne({
          _id: new ObjectId(id),
        });

        if (!request) {
          return res
            .status(404)
            .json({ message: "Donation request not found" });
        }

        res.status(200).json(request);
      } catch (error) {
        res.status(500).json({
          message: "Failed to fetch donation request",
          error: error.message,
        });
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
          return res
            .status(404)
            .json({ message: "Donation request not found" });
        }

        res.status(200).json({ message: "Donation request updated", result });
      } catch (err) {
        res.status(500).json({ message: "Update failed", error: err.message });
      }
    });

    // DELETE donation request by ID
    app.delete("/donation-requests/:id", async (req, res) => {
      const { id } = req.params;

      try {
        const result = await DonationRequests.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 0) {
          return res
            .status(404)
            .json({ message: "Donation request not found" });
        }

        res.status(200).json({ message: "Donation request deleted", result });
      } catch (error) {
        res.status(500).json({
          message: "Failed to delete donation request",
          error: error.message,
        });
      }
    });

    // POST: Create a new blog
    app.post("/blogs", async (req, res) => {
      try {
        const { title, thumbnail, content } = req.body;

        if (!title || !thumbnail || !content) {
          return res.status(400).json({ message: "All fields are required" });
        }

        const newBlog = {
          title,
          thumbnail,
          content,
          status: "draft",
          createdAt: new Date(),
        };

        const result = await Blogs.insertOne(newBlog);
        res.status(201).json({
          message: "Blog created successfully",
          blogId: result.insertedId,
        });
      } catch (err) {
        console.error("Blog creation error:", err);
        res
          .status(500)
          .json({ message: "Failed to create blog", error: err.message });
      }
    });

    // GET: Fetch all blogs
    app.get("/blogs", async (req, res) => {
      try {
        const blogs = await Blogs.find().sort({ createdAt: -1 }).toArray();
        res.status(200).json(blogs);
      } catch (err) {
        res
          .status(500)
          .json({ message: "Failed to fetch blogs", error: err.message });
      }
    });

    // GET: Get single blog by ID
    app.get("/blogs/:id", async (req, res) => {
      const { id } = req.params;
      try {
        const blog = await Blogs.findOne({ _id: new ObjectId(id) });
        if (!blog) return res.status(404).json({ message: "Blog not found" });
        res.status(200).json(blog);
      } catch (err) {
        res
          .status(500)
          .json({ message: "Failed to fetch blog", error: err.message });
      }
    });

    // PATCH: Update blog status (publish/unpublish) or edit content
    app.patch("/blogs/:id", async (req, res) => {
      const { id } = req.params;
      const updateData = req.body;
      try {
        delete updateData._id;
        const result = await Blogs.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData }
        );
        if (result.matchedCount === 0) {
          return res.status(404).json({ message: "Blog not found" });
        }
        res.status(200).json({ message: "Blog updated successfully", result });
      } catch (err) {
        res
          .status(500)
          .json({ message: "Failed to update blog", error: err.message });
      }
    });

    // DELETE: Delete blog by ID
    app.delete("/blogs/:id", async (req, res) => {
      const { id } = req.params;
      try {
        const result = await Blogs.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) {
          return res.status(404).json({ message: "Blog not found" });
        }
        res.status(200).json({ message: "Blog deleted successfully", result });
      } catch (err) {
        res
          .status(500)
          .json({ message: "Failed to delete blog", error: err.message });
      }
    });

    //Check admin or not
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const user = await Users.findOne({ email });

      res.send({ isAdmin: user?.role === "admin" });
    });

    //Check Volunteer or not
    app.get("/users/volunteer/:email", async (req, res) => {
      const email = req.params.email;
      const user = await Users.findOne({ email });

      res.send({ isVolunteer: user?.role === "volunteer" });
    });

    // POST: Create Payment Intent
    app.post("/create-payment-intent", async (req, res) => {
      const { amount } = req.body;

      if (!amount) return res.status(400).send({ message: "Amount required" });

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount * 100, // Stripe uses cents
          currency: "usd",
          payment_method_types: ["card"],
        });

        res.send({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        res
          .status(500)
          .send({ message: "Payment intent creation failed", error });
      }
    });

    // POST: Save Fund Info
    app.post("/funds", async (req, res) => {
      try {
        const fund = {
          ...req.body,
          createdAt: new Date(),
        };
        const result = await Funds.insertOne(fund);
        res.status(201).send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to save fund", error });
      }
    });

    // GET: All Funds
    app.get("/funds", verifyToken, async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;

      const total = await Funds.estimatedDocumentCount();
      const funds = await Funds.find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray();

      res.send({ total, funds });
    });

    // Total Fund Aggregation
    app.get("/funds/total", async (req, res) => {
      try {
        const total = await Funds.aggregate([
          { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
        ]).toArray();

        const totalAmount = total[0]?.totalAmount || 0;
        res.send({ totalAmount });
      } catch (error) {
        res
          .status(500)
          .send({ message: "Failed to calculate total funding", error });
      }
    });
    app.get("/analytics/donation-requests", async (req, res) => {
      try {
        const now = new Date();
        const startOfToday = new Date(now.setHours(0, 0, 0, 0));
        const startOfWeek = new Date();
        startOfWeek.setDate(now.getDate() - 6);
        startOfWeek.setHours(0, 0, 0, 0);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const dailyCount = await DonationRequests.countDocuments({
          createdAt: { $gte: startOfToday },
        });

        const weeklyCount = await DonationRequests.countDocuments({
          createdAt: { $gte: startOfWeek },
        });

        const monthlyCount = await DonationRequests.countDocuments({
          createdAt: { $gte: startOfMonth },
        });

        res.json({
          daily: dailyCount,
          weekly: weeklyCount,
          monthly: monthlyCount,
        });
      } catch (error) {
        res
          .status(500)
          .json({ message: "Failed to fetch donation analytics", error });
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
