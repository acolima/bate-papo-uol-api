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

setInterval(async () => {
  const {mongoClient, db} = await connectToDB()
  const participantsCollection = db.collection("participants")
  const messagesCollection = db.collection("messages")

  const participants = await participantsCollection.find({}).toArray()

  for(const participant of participants)
    if(participant.lastStatus < (Date.now() - 10000)){
      await participantsCollection.deleteOne({_id: participant._id})
      await messagesCollection.insertOne({
        from: participant.name, 
        to: 'Todos', 
        text: 'sai da sala...',
        type: 'status',
        time: dayjs().format('HH:mm:ss')
      })
    }
  
  mongoClient.close()
}, 15000)

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
  const {mongoClient, db} = await connectToDB()
  const participantsCollection = db.collection("participants")
  const messagesCollection = db.collection("messages")
  const participants = await participantsCollection.find({}).toArray()
  
  const validation = participantSchema.validate(req.body)
  if(validation.error){
    res.sendStatus(422)
    mongoClient.close()
    return
  }
  
  const nameTaken = participants.find(participant => participant.name === req.body.name)
  if(!nameTaken){
    try {
      await participantsCollection.insertOne({name: req.body.name, lastStatus: Date.now()})
      await messagesCollection.insertOne({
        from: req.body.name, 
        to: 'Todos', 
        text: 'entra na sala...',
        type: 'status',
        time: dayjs().format('HH:mm:ss')
      })
      
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

  const participants = await participantsCollection.find({name: req.headers.user}).toArray()
  
  const message = {...req.body, from: req.headers.user, time: dayjs().format("HH:mm:ss")}
  
  const validation = messageSchema.validate(message)
  if(validation.error || !participants){
    res.sendStatus(422)
    mongoClient.close()
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
  const user = req.headers.user
 
  const {mongoClient, db} = await connectToDB()
  const messagesCollection = db.collection("messages")
  
  try {
    const messages = await messagesCollection.find({}).toArray()
    const userMessages = messages.filter(message => 
      message.type === "message" || 
      message.type === "status" || 
      message.to === req.headers.user || 
      message.from === req.headers.user
    )

    if(limit){
      res.send(userMessages.slice(-limit))
      return
    }
    res.send(userMessages)
    mongoClient.close()
  } catch {
    res.sendStatus(500)
    mongoClient.close()
  }
})

/* Status Route */
server.post("/status", async (req, res) => {
  const {mongoClient, db} = await connectToDB()
  const participantsCollection = db.collection("participants")

  const participant = await participantsCollection.findOne({name: req.headers.user})

  if(!participant){
    res.sendStatus(404)
    mongoClient.close()
    return
  }

  try{
    const user = {name: req.headers.user, lastStatus: Date.now()}
    await participantsCollection.updateOne({name: req.headers.user}, {$set: user})
    res.sendStatus(200)
    mongoClient.close()
  } catch {
    res.sendStatus(500)
    mongoClient.close()
  }
})

server.listen(5000, () => console.log("Listening on port 5000"))