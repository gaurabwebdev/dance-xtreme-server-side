const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const app = express();
const port = process.env.PORT || 5000;

// middlewares
app.use(cors());
app.use(express.json());
require("dotenv").config();

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

const { MongoClient, ServerApiVersion } = require("mongodb");
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
      console.log(searchInstructor);
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

    app.get("/users", verifyJWToken, async (req, res) => {
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
