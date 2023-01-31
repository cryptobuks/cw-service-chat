const { ctr, rabbitmq } = require('@cowellness/cw-micro-service')()

rabbitmq.subscribe('ws', async ({ data }) => {
  if (data.module === 'status' && data.action === 'update') {
    return ctr.chat.pushStatusUpdate(data.payload)
  }
}, {})

/**
 * subscribe to auth: to get update on a relation or profile
 * and update ES index
 */
rabbitmq.subscribe('auth', async ({ data }) => {
  ctr.chat.updateFromAuth(data)
}, {})
