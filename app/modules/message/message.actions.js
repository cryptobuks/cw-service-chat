const { ctr } = require('@cowellness/cw-micro-service')()

/**
 * @class MessageActions
 * @classdesc Actions Message
 */
class MessageActions {
  async createMessage (data, reply) {
    try {
      let message = await ctr.message.createMessage(data)

      if (!message) {
        return reply.cwSendFail({
          message: 'reply.data.failed'
        })
      }
      message = ctr.message.reduceFieldsMessage(message)

      return reply.cwSendSuccess({
        message: 'reply.data.saved',
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

  async getMessages (data, reply) {
    let messages = await ctr.message.getMessages(data)

    messages = messages.map(message => ctr.message.reduceFieldsMessage(message))

    return reply.cwSendSuccess({
      data: {
        messages
      }
    })
  }

  async getOldestMessages (data, reply) {
    let messages = await ctr.message.getOldestMessages(data)

    messages = messages.map(message => ctr.message.reduceFieldsMessage(message))

    return reply.cwSendSuccess({
      data: {
        messages
      }
    })
  }

  async getLatestMessages (data, reply) {
    let messages = await ctr.message.getLatestMessages(data)

    messages = messages.map(message => ctr.message.reduceFieldsMessage(message))

    return reply.cwSendSuccess({
      data: {
        messages
      }
    })
  }

  async getSearchedMessages (data, reply) {
    let messages = await ctr.message.getSearchedMessages(data)

    messages = messages.map(message => ctr.message.reduceFieldsMessage(message))

    return reply.cwSendSuccess({
      data: {
        messages
      }
    })
  }

  async getMessage (data, reply) {
    const message = await ctr.message.getMessage(data)

    return reply.cwSendSuccess({
      data: {
        message
      }
    })
  }

  async setMessageView (data, reply) {
    let message = await ctr.message.setMessageView(data)
    message = ctr.message.reduceFieldsMessage(message)

    return reply.cwSendSuccess({
      data: {
        message
      }
    })
  }

  async setMessageClick (data, reply) {
    let message = await ctr.message.setMessageClick(data)
    message = ctr.message.reduceFieldsMessage(message)

    return reply.cwSendSuccess({
      data: {
        message
      }
    })
  }

  async setMessageReaction (data, reply) {
    let message = await ctr.message.setMessageReaction(data)
    message = ctr.message.reduceFieldsMessage(message)

    return reply.cwSendSuccess({
      data: {
        message
      }
    })
  }

  async deleteMessage (data, reply) {
    let message = await ctr.message.deleteMessage(data)
    message = ctr.message.reduceFieldsMessage(message)

    return reply.cwSendSuccess({
      data: {
        message
      }
    })
  }

  async searchMessages (data, reply) {
    const messages = await ctr.message.searchMessages(data)

    return reply.cwSendSuccess({
      data: {
        messages
      }
    })
  }

  async getReactionsList (data, reply) {
    const reactions = await ctr.message.getReactionsList(data)

    return reply.cwSendSuccess({
      data: {
        reactions
      }
    })
  }

  async deleteMessageReaction (data, reply) {
    let message = await ctr.message.deleteMessageReaction(data)
    message = ctr.message.reduceFieldsMessage(message)

    return reply.cwSendSuccess({
      data: {
        message
      }
    })
  }

  async getAttachment (data, reply) {
    const attachment = await ctr.message.getAttachment(data)

    return reply.cwSendSuccess({
      data: {
        attachment
      }
    })
  }

  async hideInDashboard (data, reply) {
    const message = await ctr.message.hideInDashboard(data)

    return reply.cwSendSuccess({
      data: {
        message
      }
    })
  }
}

module.exports = MessageActions
