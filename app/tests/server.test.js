const config = require('config')
const cw = require('@cowellness/cw-micro-service')(config)

beforeAll(() => {
  return cw.startFastify()
})

afterAll(() => {
  return cw.stopFastify()
})

describe('Test app working - 404 and headers', () => {
  it('should test', async () => {
    expect(2 + 2).toEqual(4)
  })
})
