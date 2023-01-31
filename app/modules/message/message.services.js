const { ctr, rabbitmq } = require('@cowellness/cw-micro-service')()
const validationSchema = require('./message.schema')

/**
 * Creates a message sent from mail-in-chat service
 */
rabbitmq.consume('/chat/message/mailInChat/create', async ({ data }) => {
  return ctr.message.createMailMessage(data)
})

/**
 * Creates a message in chat channel
 */
rabbitmq.consume('/chat/message/create', async ({ data }) => {
  const _user = {
    profileId: data.fromProfileId,
    managerId: data.fromManagerProfileId
  }
  return ctr.message.createMessage({
    _user,
    ...data
  })
}, { schema: validationSchema.createMessage.schema.body })

/**
 * Creates a message in system channel
 */
rabbitmq.consume('/chat/message/system', async ({ data }) => {
  return ctr.message.createSystemMessage(data)
})

/**
 * Creates a message in book channel
 */
rabbitmq.consume('/chat/message/gym-device/book', async ({ data }) => {
  return ctr.message.bookShift(data)
}, { schema: validationSchema.gymDeviceBook.schema.body })

/**
 * removes a booking
 */
rabbitmq.consume('/chat/message/gym-device/unbook', async ({ data }) => {
  return ctr.message.unbook(data)
}, { schema: validationSchema.gymDeviceBook.schema.body })

/**
 * Creates a message in ask channel
 */
rabbitmq.consume('/chat/message/gym-device/ask', async ({ data }) => {
  return ctr.message.askInfo(data)
}, { schema: validationSchema.gymDeviceAsk.schema.body })

/**
 * Creates a message with action type
 */
rabbitmq.consume('/chat/message/action/create', async ({ data }) => {
  const _user = {
    profileId: data.fromProfileId,
    managerId: data.fromManagerProfileId
  }
  return ctr.message.createMessage({
    _user,
    ...data
  })
}, { schema: validationSchema.createActionMessage.schema.body })

rabbitmq.consume('/chat/message/responded/check', async ({ data }) => {
  return ctr.message.chatPluginAutoMessageCheck(data)
})
