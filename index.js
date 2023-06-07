const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;

// middlewares
app.use(cors());
app.use(express.json());
require("dotenv").config();

app.get("/", (req, res) => {
  res.send("Dance Xtreme");
});

app.listen(port, () => {
  console.log(`Dance Xtreme is running on ${port}`);
});
