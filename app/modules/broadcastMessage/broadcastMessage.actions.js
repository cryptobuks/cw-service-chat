const { ctr } = require('@cowellness/cw-micro-service')()

/**
 * @class BroadcastMessageActions
 * @classdesc Actions BroadcastMessage
 */
class BroadcastMessageActions {
  async getBroadcastMessages (data, reply) {
    const messages = await ctr.broadcastMessage.getBroadcastMessages(data)

    return reply.cwSendSuccess({
      data: {
        messages
      }
    })
  }

  async createBroadcastMessage (data, reply, auth) {
    try {
      const message = await ctr.broadcastMessage.createBroadcastMessage(data, auth)

      return reply.cwSendSuccess({
        data: {
          message
        }
      })
    } catch (error) {
      reply.cwSendFail({
        message: error.message
      })
    }
  }

  async getOldestMessages (data, reply) {
    const messages = await ctr.broadcastMessage.getOldestMessages(data)

    return reply.cwSendSuccess({
      data: {
        messages
      }
    })
  }

  async getLatestMessages (data, reply) {
    const messages = await ctr.broadcastMessage.getLatestMessages(data)

    return reply.cwSendSuccess({
      data: {
        messages
      }
    })
  }

  async getSearchedMessages (data, reply) {
    const messages = await ctr.broadcastMessage.getSearchedMessages(data)

    return reply.cwSendSuccess({
      data: {
        messages
      }
    })
  }
}

module.exports = BroadcastMessageActions
