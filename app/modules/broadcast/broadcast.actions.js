const { ctr } = require('@cowellness/cw-micro-service')()

/**
 * @class BroadcastActions
 * @classdesc Actions Broadcast
 */
class BroadcastActions {
  async getBroadcasts (data, reply) {
    const broadcasts = await ctr.broadcast.getBroadcasts(data)

    return reply.cwSendSuccess({
      data: {
        broadcasts
      }
    })
  }

  async createBroadcast (data, reply, auth) {
    try {
      const broadcast = await ctr.broadcast.createBroadcast(data, auth)

      return reply.cwSendSuccess({
        data: {
          broadcast
        }
      })
    } catch (error) {
      return reply.cwSendFail({
        message: error.message
      })
    }
  }

  async getBroadcast (data, reply) {
    try {
      const broadcast = await ctr.broadcast.getBroadcast(data)

      return reply.cwSendSuccess({
        data: {
          broadcast
        }
      })
    } catch (error) {
      return reply.cwSendFail({
        message: error.message
      })
    }
  }

  async updateBroadcast (data, reply, auth) {
    try {
      const broadcast = await ctr.broadcast.updateBroadcast(data, auth)

      return reply.cwSendSuccess({
        data: {
          broadcast
        }
      })
    } catch (error) {
      return reply.cwSendFail({
        message: error.message
      })
    }
  }

  async deleteBroadcast (data, reply) {
    try {
      const deleted = await ctr.broadcast.deleteBroadcast(data)

      return reply.cwSendSuccess({
        data: {
          deleted
        }
      })
    } catch (error) {
      return reply.cwSendFail({
        message: error.message
      })
    }
  }

  async filterTarget (data, reply) {
    const filter = await ctr.broadcast.filterTarget(data)

    return reply.cwSendSuccess({
      data: {
        filter
      }
    })
  }

  async changeMemberStatus (data, reply) {
    const broadcast = await ctr.broadcast.changeMemberStatus(data)

    return reply.cwSendSuccess({
      data: {
        broadcast
      }
    })
  }
}

module.exports = BroadcastActions
