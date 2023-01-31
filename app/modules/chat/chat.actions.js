const { ctr, _ } = require('@cowellness/cw-micro-service')()

/**
 * @class ChatActions
 * @classdesc Actions Chats
 */
class ChatActions {
  async getChats (data, reply, auth) {
    const permission = data._user.permission
    let chats = await ctr.chat.getChats(data)
    const isSalesman = await auth.isSalesman()

    if (isSalesman) {
      chats = chats.filter(chat => chat.type !== 'group')
    }
    if (!_.get(permission, 'chat.group.read')) {
      const groupEnabled = []
      const isTrainer = await auth.isTrainer()

      if (isTrainer) {
        const chatGroups = await ctr.chat.getCourseTrainerGroups(data._user.profileId)

        groupEnabled.push(...chatGroups)
      }
      chats = chats.filter(chat => chat.type !== 'group' || groupEnabled.includes(chat.id))
    }
    return reply.cwSendSuccess({
      data: {
        chats
      }
    })
  }

  async getChat (data, reply) {
    const details = await ctr.chat.getChat(data)

    return reply.cwSendSuccess({
      data: {
        details
      }
    })
  }

  async searchChats (data, reply) {
    const chats = await ctr.chat.searchChats(data)

    return reply.cwSendSuccess({
      data: {
        chats
      }
    })
  }

  async getFriend (data, reply) {
    const profile = await ctr.chat.getFriend(data)

    return reply.cwSendSuccess({
      data: {
        profile
      }
    })
  }

  async getFriends (data, reply) {
    const profiles = await ctr.chat.getFriends(data)

    return reply.cwSendSuccess({
      data: {
        profiles
      }
    })
  }

  async typing (data, reply) {
    ctr.chat.pushMessage({
      toProfileIds: [data.profileId],
      action: 'typing',
      data: {
        fromProfileId: data._user.profileId,
        toProfileId: data.profileId,
        chatId: data.chatId
      }
    })
    return reply.cwSendSuccess()
  }
}

module.exports = ChatActions
