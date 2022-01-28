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

/* Schemes */
const participantSchema = joi.object({
  name: joi.string().required()
})

const messageSchema = joi.object({
  to: joi.string().required(),
  text: joi.string().required(),
  type: joi.string().regex(/message|private_message/).required(),
  from: joi.string().required(),
  time: joi.string().required()
})

/* Participants Routes */
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

/* Messages Routes */
server.post("/messages", async (req, res) => {
  const {mongoClient, db} = await connectToDB()
  const messagesCollection = db.collection("messages")
  const participantsCollection = db.collection("participants")
  const time = dayjs().format("HH:mm:ss")

  const participants = await participantsCollection.find({}).toArray()
  const inParticipantsList = participants.find(participant => participant.name === req.headers.user)
  
  const message = {...req.body, from: req.headers.user, time }
  
  const validation = messageSchema.validate(message)
  
  if(validation.error || !inParticipantsList){
    res.sendStatus(422)
    return
  }

  try{
    await messagesCollection.insertOne(message)
    
    res.sendStatus(201)
    mongoClient.close()
  } catch {
    res.sendStatus(500)
    mongoClient.close()  
  }
})

server.get("/messages", async (req, res) => {
  const limit = req.query.limit
  // const user = req.headers.user
  // console.log(user)
  
  
  const {mongoClient, db} = await connectToDB()
  const messagesCollection = db.collection("messages")
  
  try {
    const userMessages = await messagesCollection.find({}).toArray()
    let messages = userMessages

    if(limit)
      messages = userMessages.slice(-limit)
    
    //console.log(messages)
    res.send(messages)
    mongoClient.close()
  } catch {
    res.sendStatus(500)
    mongoClient.close()
  }
})


server.listen(5000, () => console.log("Listening on port 5000"))