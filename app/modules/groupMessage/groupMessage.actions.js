const { ctr } = require('@cowellness/cw-micro-service')()

/**
 * @class GroupActions
 * @classdesc Actions Group
 */
class GroupActions {
  async getGroupMessages (data, reply) {
    const messages = await ctr.groupMessage.getGroupMessages(data)

    if (!messages) {
      return reply.cwSendFail({
        message: 'not_authorized'
      })
    }
    return reply.cwSendSuccess({
      data: {
        messages
      }
    })
  }

  async createGroupMessage (data, reply) {
    try {
      const message = await ctr.groupMessage.createGroupMessage(data)

      return reply.cwSendSuccess({
        data: {
          message
        }
      })
    } catch (error) {
      return reply.cwSendFail({
        message: error.message
      })
    }
  }

  async getOldestMessages (data, reply) {
    const messages = await ctr.groupMessage.getOldestMessages(data)

    return reply.cwSendSuccess({
      data: {
        messages
      }
    })
  }

  async getLatestMessages (data, reply) {
    const messages = await ctr.groupMessage.getLatestMessages(data)

    return reply.cwSendSuccess({
      data: {
        messages
      }
    })
  }

  async getSearchedMessages (data, reply) {
    const messages = await ctr.groupMessage.getSearchedMessages(data)

    return reply.cwSendSuccess({
      data: {
        messages
      }
    })
  }

  async setMessageView (data, reply) {
    let message = await ctr.groupMessage.setMessageView(data)
    message = ctr.message.reduceFieldsMessage(message)

    return reply.cwSendSuccess({
      data: {
        message
      }
    })
  }

  async setMessageReaction (data, reply) {
    let message = await ctr.groupMessage.setMessageReaction(data)
    message = ctr.message.reduceFieldsMessage(message)

    return reply.cwSendSuccess({
      data: {
        message
      }
    })
  }
}

module.exports = GroupActions
