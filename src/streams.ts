import { createReadStream, createWriteStream } from 'fs'
import { Readable, Writable } from 'stream'
import ldj from 'ndjson'

export const createFileReader = (path: string): Readable =>
  createReadStream(path, { encoding: 'utf8' }).pipe(ldj.parse())

export const createFileWriter = (path: string): Writable => {
  const stream = ldj.serialize()
  const file = createWriteStream(path, { flags: 'a' })
  stream.pipe(file)
  return stream
}
