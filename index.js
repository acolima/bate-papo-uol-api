import express, { json } from "express"
import { MongoClient } from "mongodb"
import dotenv from "dotenv"

dotenv.config()
const server = express()
server.use(json())

server.get("/participants", async (req, res) => {
  let mongoClient 
  try{
    mongoClient = new MongoClient(process.env.MONGO_URI)
    await mongoClient.connect()
    const db = mongoClient.db("BatePapo")
    const parcipantsCollection = db.collection("participants")
    const participants = await parcipantsCollection.find({}).toArray()
    
    res.send(participants)
    mongoClient.close()
  } catch {
    console.log("Falha  na conexão com o servidor")
    res.sendStatus(500)
    mongoClient.close()
  }
})

server.listen(5000, () => console.log("Listening on port 5000"))