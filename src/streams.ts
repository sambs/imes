import { createReadStream, promises } from 'fs'
import { Readable } from 'stream'
import ldj from 'ndjson'

export const createFileReader = (path: string): Readable =>
  createReadStream(path, { encoding: 'utf8' }).pipe(ldj.parse())

export const createWriteToFile = (path: string) => (
  event: any
): Promise<void> => {
  return promises.appendFile(path, JSON.stringify(event) + '\n')
}
