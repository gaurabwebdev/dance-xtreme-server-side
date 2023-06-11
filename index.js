const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const app = express();
const port = process.env.PORT || 5000;

// middlewares
app.use(cors());
app.use(express.json());
require("dotenv").config();

const stripe = require("stripe")(`${process.env.STRIPE_SK}`);

// Verify JSON WEB TOKEN ======
const verifyJWToken = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (authorization) {
    const token = authorization.split(" ")[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, (error, decoded) => {
      if (error) {
        return res
          .status(403)
          .send({ error: true, message: "Unauthorized Access" });
      }
      req.decoded = decoded;
      next();
    });
  } else {
    return res
      .status(401)
      .send({ error: true, message: "Unauthorized Access" });
  }
};

// Cart calculation
const calculateCart = (amount) => {
  return amount * 100;
};

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wqlyhsd.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  const dataBase = client.db("danceXtreme");
  const usersCollection = dataBase.collection("users");
  const classes = dataBase.collection("classes");
  const classSelection = dataBase.collection("selectedClasses");
  const enrolledClasses = dataBase.collection("enrolledClasses");
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // admin verification middleware
    const verifyAdmin = async (req, res, next) => {
      const query = { email: req.decoded.email };
      const searchAdmin = await usersCollection.findOne(query);
      if (searchAdmin.role !== "admin") {
        return res.status(403).send({ error: true, message: "Bad Access" });
      }

      next();
    };
    // instructor verification middleware
    const verifyInstructor = async (req, res, next) => {
      const query = { email: req.decoded.email };

      const searchInstructor = await usersCollection.findOne(query);
      if (searchInstructor.role !== "instructor") {
        return res.status(403).send({ error: true, message: "Bad Access" });
      }

      next();
    };

    // All APIs
    app.get("/", (req, res) => {
      res.send("Dance Xtreme");
    });

    // jwt issue API
    app.post("/jwt", (req, res) => {
      const currentUser = req.body;
      if (currentUser?.email) {
        const jwToken = jwt.sign(currentUser, process.env.ACCESS_TOKEN, {
          expiresIn: "3h",
        });
        res.send({ jwToken });
      }
    });

    // Users API --- (Confidential)
    app.post("/users", async (req, res) => {
      const newUser = req.body;

      const query = { email: newUser.email };
      const foundUser = await usersCollection.findOne(query);

      if (foundUser) {
        return res.send({ message: "user already exist" });
      }
      const result = await usersCollection.insertOne(newUser);
      res.send(result);
    });

    app.get("/users", verifyJWToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // verifying admin
    app.get(
      "/users/admin/:email",
      verifyJWToken,
      verifyAdmin,
      async (req, res) => {
        const email = req.params.email;
        if (req.decoded.email !== email) {
          return res.status(403).send({ admin: false });
        }
        const query = { email: email };
        const result = await usersCollection.findOne(query);
        res.send({ admin: true });
      }
    );
    // verifying instructor
    app.get(
      "/users/instructor/:email",
      verifyJWToken,
      verifyInstructor,
      async (req, res) => {
        const email = req.params.email;
        if (req.decoded.email !== email) {
          return res.status(403).send({ instructor: false });
        }
        const query = { email: email };
        const result = await usersCollection.findOne(query);
        res.send({ instructor: true });
      }
    );
    // Make Admin API
    app.patch(
      "/users/make-admin/:id",
      verifyJWToken,
      verifyAdmin,
      async (req, res) => {
        const filter = { _id: new ObjectId(req.params.id) };
        const options = { upsert: true };
        const updateField = {
          $set: {
            role: `admin`,
          },
        };
        const result = await usersCollection.updateOne(
          filter,
          updateField,
          options
        );
        res.send(result);
      }
    );
    // Make Instructor API
    app.patch(
      "/users/make-instructor/:id",
      verifyJWToken,
      verifyAdmin,
      async (req, res) => {
        const filter = { _id: new ObjectId(req.params.id) };
        const updateField = {
          $set: {
            role: `instructor`,
          },
        };
        const result = await usersCollection.updateOne(filter, updateField);
        res.send(result);
      }
    );
    // Open Instructor API
    app.get("/all-instructors", async (req, res) => {
      const query = { role: "instructor" };
      const options = {
        projection: {
          photo_url: 1,
          email: 1,
          name: 1,
        },
      };
      const result = await usersCollection.find(query, options).toArray();

      res.send(result);
    });

    // Class Management APIs
    // Open CLass API
    app.get("/all-classes", async (req, res) => {
      const query = { status: "approved" };
      const options = {
        sort: { price: -1 },
        projection: {
          class_img_url: 1,
          class_name: 1,
          name: 1,
          available_seats: 1,
          price: 1,
        },
      };
      const result = await classes.find(query, options).toArray();

      res.send(result);
    });

    app.get("/get-popular-classes", async (req, res) => {
      const query = { status: "approved" };
      const options = {
        sort: { total_enrolled_student: -1 },
        projection: {
          class_img_url: 1,
          class_name: 1,
        },
      };
      const result = await classes.find(query, options).toArray();

      res.send(result);
    });

    // Classes Posting API
    app.post("/classes", verifyJWToken, verifyInstructor, async (req, res) => {
      const newClass = req.body;
      const result = await classes.insertOne(newClass);
      res.send(result);
    });

    // Selected Class User API
    app.post("/selected-classes", verifyJWToken, async (req, res) => {
      const { selectedClassData } = req.body;
      if (selectedClassData) {
        const result = await classSelection.insertOne(selectedClassData);
        return res.send(result);
      }
    });

    app.get("/selected-classes", verifyJWToken, async (req, res) => {
      const email = req.query.email;
      if (req.decoded.email !== email) {
        return res
          .status(403)
          .send({ error: true, message: "Forbidden Access" });
      }
      const query = { userEmail: email };
      const result = await classSelection.find(query).toArray();
      res.send(result);
    });

    app.delete("/selected-classes/:id", verifyJWToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classSelection.deleteOne(query);
      res.send(result);
    });

    // Class Details Access API

    app.get("/classes", verifyJWToken, verifyAdmin, async (req, res) => {
      const allClasses = await classes.find().toArray();
      res.send(allClasses);
    });

    // Individual Instructor Based API
    app.get(
      "/classes/:email",
      verifyJWToken,
      verifyInstructor,
      async (req, res) => {
        const email = req.params.email;
        const query = { email: email };
        const result = await classes.find(query).toArray();
        res.send(result);
      }
    );

    // Class Approval API
    app.patch("/classes", verifyJWToken, verifyAdmin, async (req, res) => {
      const id = req.query.classId;
      const newStatus = req.query.newStatus;
      const feedback = req.body.feedback;

      if (id && newStatus === "approved") {
        const query = { _id: new ObjectId(id) };
        const updateField = {
          $set: {
            status: newStatus,
          },
        };
        const result = await classes.updateOne(query, updateField);
        return res.send(result);
      }

      if (id && newStatus === "denied" && feedback) {
        const query = { _id: new ObjectId(id) };
        const options = { upsert: true };
        const updateField = {
          $set: {
            status: newStatus,
            feedback: feedback,
          },
        };
        const result = await classes.updateOne(query, updateField, options);
        return res.send(result);
      }
    });

    // Creating Payment Intent
    app.post("/create-payment-intent", verifyJWToken, async (req, res) => {
      const cardAmount = req.body.totalPrice;

      const paymentIntent = await stripe.paymentIntents.create({
        amount: calculateCart(cardAmount),
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    // Payment Info API
    app.post("/payment", verifyJWToken, async (req, res) => {
      const { currentPaymentInfo } = req.body;
      const { email, name, transactionId, cartItemId, className, classId } =
        currentPaymentInfo;
      if (currentPaymentInfo) {
        const result = await enrolledClasses.insertOne(currentPaymentInfo);
        if (result.insertedId) {
          cartItemId.forEach(async (item) => {
            const query = { _id: new ObjectId(item) };
            const deleteRes = await classSelection.deleteOne(query);
          });
          classId.forEach(async (singleId) => {
            const query = { _id: new ObjectId(singleId) };
            const updateField = {
              $inc: {
                available_seats: -1,
                total_enrolled_student: 1,
              },
            };

            const updateStudents = await classes.updateOne(query, updateField);
          });
          res.send(result);
        }
      }
      // const result = await enrolledClasses.insertOne(currentPaymentInfo);
      // res.send(result);
    });

    // Paid Classes API
    app.get("/enrolled-classes", verifyJWToken, async (req, res) => {
      const email = req.query.email;
      if (req.decoded.email !== email) {
        return res
          .status(401)
          .send({ error: true, message: "Unauthorized access" });
      }
      const query = { email: email };
      const options = {
        projection: {
          paymentDate: 1,
          price: 1,
          className: 1,
        },
      };
      const result = await enrolledClasses.find(query, options).toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Dance Xtreme is running on ${port}`);
});
