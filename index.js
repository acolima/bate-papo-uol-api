import express, { json } from "express"
import { MongoClient } from "mongodb"
import dotenv from "dotenv"
import cors from "cors"
import joi from "joi"
import dayjs from "dayjs"

dotenv.config()

const server = express()
server.use(json())
server.use(cors())

async function connectToDB(){
  try {
    const mongoClient = new MongoClient(process.env.MONGO_URI)
    await mongoClient.connect()
    const db = mongoClient.db("BatePapo")
    
    return {mongoClient, db}
  } catch {
    console.log("Erro de conexão com servidor")
  }
}

const participantSchema = joi.object({
  name: joi.string().required()
})

server.post("/participants", async (req, res) => {
  const validation = participantSchema.validate(req.body)

  if(validation.error){
    res.sendStatus(422)
    return
  }

  const {mongoClient, db} = await connectToDB()
  const participantsCollection = db.collection("participants")
  const messagesCollection = db.collection("messages")

  const participants = await participantsCollection.find({}).toArray()
  const nameTaken = participants.find(participant => participant.name === req.body.name)

  if(!nameTaken){
    const message = {
      from: req.body.name, 
      to: 'Todos', 
      text: 'entra na sala...',
      type: 'status',
      time: dayjs().format('HH:mm:ss')
    }
    try {
      await participantsCollection.insertOne({name: req.body.name, lastStatus: Date.now()})
      await messagesCollection.insertOne(message)
      
      res.sendStatus(201)
      mongoClient.close()
    } catch (error) {
      res.sendStatus(500)
      mongoClient.close()
    }
  } else res.sendStatus(409)
})

server.get("/participants", async (req, res) => {
  const {mongoClient, db} = await connectToDB()
  const participantsCollection = db.collection("participants")

  try{
    const participants = await participantsCollection.find({}).toArray()
    
    res.send(participants)
    mongoClient.close()
  } catch {
    res.sendStatus(500)
    mongoClient.close()
  }
})


server.listen(5000, () => console.log("Listening on port 5000"))