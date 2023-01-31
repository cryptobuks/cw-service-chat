const { ctr } = require('@cowellness/cw-micro-service')()

/**
 * @class GroupActions
 * @classdesc Actions Group
 */
class GroupActions {
  async getGroups (data, reply) {
    const groups = await ctr.group.getGroups(data)

    return reply.cwSendSuccess({
      data: {
        groups
      }
    })
  }

  async createGroup (data, reply, auth) {
    try {
      const group = await ctr.group.createGroup(data, auth)

      return reply.cwSendSuccess({
        data: {
          group
        }
      })
    } catch (error) {
      return reply.cwSendFail({
        message: error.message
      })
    }
  }

  async getGroup (data, reply) {
    const group = await ctr.group.getGroup(data)

    return reply.cwSendSuccess({
      data: {
        group
      }
    })
  }

  async updateGroup (data, reply) {
    const group = await ctr.group.updateGroup(data)

    return reply.cwSendSuccess({
      data: {
        group
      }
    })
  }

  async deleteGroup (data, reply) {
    const deleted = await ctr.group.deleteGroup(data)

    return reply.cwSendSuccess({
      data: {
        deleted
      }
    })
  }

  async changeMemberStatus (data, reply) {
    const group = await ctr.group.changeMemberStatus(data)

    return reply.cwSendSuccess({
      data: {
        group
      }
    })
  }
}

module.exports = GroupActions
