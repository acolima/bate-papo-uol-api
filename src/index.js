import express, { json } from "express"
import { MongoClient, ObjectId } from "mongodb"
import dotenv from "dotenv"
import cors from "cors"
import joi from "joi"
import dayjs from "dayjs"
import { stripHtml } from "string-strip-html"

dotenv.config()

const server = express()
server.use(json())
server.use(cors())

async function connectToDB() {
  try {
    const mongoClient = new MongoClient(process.env.MONGO_URI)
    await mongoClient.connect()
    const db = mongoClient.db("BatePapo")
    const participantsCollection = db.collection("participants")
    const messagesCollection = db.collection("messages")

    return { participantsCollection, messagesCollection }
  } catch (error) {
    console.error(error)
  }
}

setInterval(async () => {
  const { mongoClient, db } = await connectToDB()
  const participantsCollection = db.collection("participants")
  const messagesCollection = db.collection("messages")

  const participants = await participantsCollection.find({}).toArray()

  for (const participant of participants)
    if (participant.lastStatus < (Date.now() - 10000)) {
      await participantsCollection.deleteOne({ _id: participant._id })
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
  const name = stripHtml(req.body.name).result.trim()

  try {
    const { participantsCollection, messagesCollection } = await connectToDB()
    const nameTaken = await participantsCollection.findOne({ name })

    const validation = participantSchema.validate({ name })
    if (validation.error) return res.sendStatus(422)

    if (!nameTaken) {
      await participantsCollection.insertOne({ name: name, lastStatus: Date.now() })
      await messagesCollection.insertOne({
        from: name,
        to: 'Todos',
        text: 'entra na sala...',
        type: 'status',
        time: dayjs().format('HH:mm:ss')
      })
      res.sendStatus(201)
    }
    else res.sendStatus(409)
  } catch (error) {
    console.log(error)
    res.sendStatus(500)
  }
})

server.get("/participants", async (req, res) => {
  try {
    const { participantsCollection } = await connectToDB()
    const participants = await participantsCollection.find({}).toArray()

    res.send(participants)
  } catch (error) {
    console.log(error)
    res.sendStatus(500)
  }
})

/* Messages Routes */
server.post("/messages", async (req, res) => {
  const name = stripHtml(req.headers.user).result.trim()

  try {
    const { participantsCollection, messagesCollection } = await connectToDB()
    const participant = await participantsCollection.findOne({ name: name })

    const message = {
      to: stripHtml(req.body.to).result.trim(),
      type: stripHtml(req.body.type).result.trim(),
      text: stripHtml(req.body.text).result.trim(),
      from: name,
      time: dayjs().format("HH:mm:ss")
    }

    const validation = messageSchema.validate(message)
    if (validation.error || !participant) return res.sendStatus(422)

    await messagesCollection.insertOne(message)
    res.sendStatus(201)
  } catch (error) {
    console.log(error)
    res.sendStatus(500)
  }
})

server.get("/messages", async (req, res) => {
  const limit = req.query.limit
  const name = req.headers.user

  try {
    const { messagesCollection } = await connectToDB()
    const messages = await messagesCollection.find({ $or: [{ from: name }, { to: name }, { type: "message" }, { type: "status" }] }).toArray()

    if (limit) return res.send(messages.slice(-limit))

    res.send(messages)
  } catch (error) {
    console.log(error)
    res.sendStatus(500)
  }
})

server.delete("/messages/:id", async (req, res) => {
  const name = req.headers.user
  const { id } = req.params

  try {
    const { messagesCollection } = await connectToDB()
    const messages = await messagesCollection.findOne({ _id: ObjectId(id) })

    if (!messages) return res.sendStatus(404)

    if (messages.from !== name) return res.sendStatus(401)

    await messagesCollection.deleteOne({ _id: messages._id })
  } catch (error) {
    console.log(error)
    res.sendStatus(500)
  }
})

server.put("/messages/:id", async (req, res) => {
  const { id } = req.params
  const name = req.headers.user

  try {
    const { messagesCollection, participantsCollection } = await connectToDB()
    const participant = await participantsCollection.find({ name: name }).toArray()

    const newMessage = { ...req.body, from: name, time: dayjs().format("HH:mm:ss") }

    const validation = messageSchema.validate(newMessage)
    if (validation.error || !participant) return res.sendStatus(422)

    const message = await messagesCollection.findOne({ _id: new ObjectId(id) })
    if (!message) return res.sendStatus(404)

    if (message.from !== req.headers.user) return res.sendStatus(401)

    await messagesCollection.updateOne({ _id: new ObjectId(id) }, { $set: { text: newMessage.text } })
    res.sendStatus(200)
  } catch (error) {
    console.log(error)
    res.sendStatus(500)
  }
})

/* Status Route */
server.post("/status", async (req, res) => {
  const name = stripHtml(req.headers.user).result.trim()

  try {
    const { participantsCollection } = await connectToDB()
    const participant = await participantsCollection.findOne({ name: name })

    if (!participant) return res.sendStatus(404)

    const user = { name, lastStatus: Date.now() }
    await participantsCollection.updateOne({ name: name }, { $set: user })
    res.sendStatus(200)
  } catch (error) {
    console.log(error)
    res.sendStatus(500)
  }
})

server.listen(process.env.PORT, () => console.log(`Listening on port ${process.env.PORT}`))