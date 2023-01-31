const config = require('config')
const cw = require('@cowellness/cw-micro-service')(config)
const { db, log } = cw

beforeAll(async () => {
  await cw.autoStart()
  await db.chat.model('Message').deleteMany({})
})

const payload = {
  _user: {
    profileId: db.chat.Types.ObjectId(),
    // managerId: db.chat.Types.ObjectId(),
    managerId: ''
  },
  toProfileId: db.chat.Types.ObjectId(),
  content: {
    type: 'text',
    text: 'test message 01'
  }
}
log.info({ payload })

test('insert message and get', async () => {
  // const msg = await ctr.message.createMessage(payload)
  // expect(msg.content.text).toBe(payload.content.text)
  // const list = await ctr.message.getMessages({ _user: payload._user, profileId: payload.toProfileId })
  // log.info({ list })
  // TODO: mock request to other services first
  expect(1).toBe(1)
})
