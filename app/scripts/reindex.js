process.env.NODE_ENV = 'production'
const config = require('config')
config.fastify.port = 0
const cw = require('@cowellness/cw-micro-service')(config)
const constants = require('../modules/message/message.constants')
cw.autoStart().then(async () => {
  try {
    const Message = cw.db.chat.model('Message')
    const Group = cw.db.chat.model('Group')
    const GroupMessage = cw.db.chat.model('GroupMessage')
    const Broadcast = cw.db.chat.model('Broadcast')
    const BroadcastMessage = cw.db.chat.model('Broadcastmessage')

    const messages = await Message.find()
    await Promise.all(messages.map(item => item.save()))
    const groups = await Group.find()
    await Promise.all(groups.map(item => item.save()))
    const broadcasts = await Broadcast.find()
    await Promise.all(broadcasts.map(item => item.save()))
    const groupMessages = await GroupMessage.find()
    await Promise.all(groupMessages.map(item => item.save()))
    const broadcastMessages = await BroadcastMessage.find()
    await Promise.all(broadcastMessages.map(item => item.save()))
    const profileIds = []
    messages.forEach(item => {
      if (item.fromProfileId === constants.systemChatId) {
        if (!profileIds.includes(item.toProfileId)) {
          profileIds.push(item.toProfileId)
        }
      }
    })

    await Promise.all(profileIds.map(id => cw.ctr.message.updateEsSytemChatIndex(id)))
  } catch (error) {
    console.log(error)
  }
})
