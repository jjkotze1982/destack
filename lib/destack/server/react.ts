import express from 'express'
import cors from 'cors'

import { handleEditor } from './api/handle'
import { standaloneServerPort as port } from './config'

const app = express()

app.use(cors({ credentials: true, origin: true }))

app.get('/ping', (_, res) => {
  res.send('pong!')
})

app.all('/api/builder/handle', cors(), (req, res) => {
  return handleEditor(req, res)
})

app.listen(port, () => {
  console.log(`Server started at http://localhost:${port}`)
})
