export const sequentialIdGenerator = (prefix = '') => {
  let count = 0
  return () => `${prefix}${count++}`
}

export const generateRandomId = () =>
  Math.random()
    .toString()
    .slice(2, 10)

export const getCurrentTime = () => new Date().toISOString()
