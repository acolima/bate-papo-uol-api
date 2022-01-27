import express from "express"
import { MongoClient } from "mongodb"
import dotenv from "dotenv"

dotenv.config()
const app = express()

app.get("/", (req, res) => {
  res.send("Hello world!")
})

app.listen(5000)