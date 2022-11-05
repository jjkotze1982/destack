/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { dataType } from '../../types'
import { formParse, getJson, zip, exists, readdirRecursive } from '../utils'
import fs from 'fs'
import path from 'path'
import { IncomingForm } from 'formidable'
import { NextApiResponse, NextApiRequest } from 'next'

const development = process.env.NODE_ENV !== 'production'

const rootPath = process.cwd()

const folderPath = 'data'
const uploadPath = 'uploaded'

import formidable from 'formidable'

const uploadFiles = async (req: NextApiRequest): Promise<string[]> => {
  const form = new IncomingForm({ uploadDir: uploadPath, keepExtensions: true })

  const uploadFolder = path.join('public', uploadPath)
  const uploadFolderExists = await exists(uploadFolder)
  if (!uploadFolderExists) {
    await fs.promises.mkdir(uploadFolder)
  }

  form.on('fileBegin', (_, file) => (file.path = path.join('public', uploadPath, file.name!)))
  const files = await formParse(form, req)

  const urls = Object.values(files).map((f) =>
    path.join(path.sep, uploadPath, (<formidable.File>f).name ?? ''),
  )
  return urls
}
export { uploadFiles }

const loadData = async (): Promise<dataType[]> => {
  const basePath = path.join(rootPath, folderPath)
  const folderExists = await exists(basePath)
  if (!folderExists) return []
  const files = readdirRecursive(basePath) as string[]

  const filesData = await Promise.all(files.map((f) => fs.promises.readFile(f)))

  const data = zip([files, filesData]).map(([filename, content]) => ({
    filename: filename.replace(basePath, ''),
    content: content.toString(),
  }))

  return data
}
export { loadData }

const updateData = async (body: Record<string, string>): Promise<void> => {
  const basePath = path.join(rootPath, folderPath)
  const fileExists = await exists(path.join(basePath, body.path))
  if (!fileExists) {
    const folderPathExists = body.path.split(path.sep).slice(0, -1).join(path.sep)
    const folderExists = await exists(path.join(basePath, folderPathExists))
    if (!folderExists) {
      await fs.promises.mkdir(path.join(basePath, folderPathExists), { recursive: true })
    }
    await fs.promises.writeFile(path.join(basePath, body.path), '{}')
  }
  await fs.promises.writeFile(path.join(basePath, body.path), JSON.stringify(body.data))
}
export { updateData }

const handleData = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
  if (req.method === 'GET') {
    const data = await loadData()
    return res.status(200).json(data)
  } else if (req.method === 'POST') {
    const contentType = req.headers['content-type']!
    const isMultiPart = contentType.startsWith('multipart/form-data')
    if (!isMultiPart) {
      const body = await getJson(req)
      await updateData(body)
      return res.status(200).json({})
    } else {
      const urls = await uploadFiles(req)
      return res.status(200).json(urls)
    }
  } else {
    return res.status(401).json({ error: 'Not allowed' })
  }
}

const handleAsset = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
  if (req.method === 'GET') {
    const assetPath = path.join(
      process.cwd(),
      '..',
      '..',
      'lib',
      'destack',
      req.query.path as string,
    )
    const data = await fs.promises.readFile(assetPath)

    const options = { 'Content-Type': 'image/png', 'Content-Length': data.length }
    res.writeHead(200, options)
    res.end(data, 'binary')
  } else {
    return res.status(401).json({ error: 'Not allowed' })
  }
}

const handleEditor = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
  if (!development) return res.status(401).json({ error: 'Not allowed' })

  if (req.query.type === 'data') {
    return handleData(req, res)
  } else if (req.query.type === 'asset') {
    return handleAsset(req, res)
  } else {
    return res.status(400).json({ error: 'Invalid type' })
  }
}
export { handleEditor }

const config = { api: { bodyParser: false } }
export { config }
