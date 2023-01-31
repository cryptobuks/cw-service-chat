const { ctr } = require('@cowellness/cw-micro-service')()

/**
 * @class WebPreviewActions
 * @classdesc Actions WebPreview
 */
class WebPreviewActions {
  async getPreview (data, reply) {
    const preview = await ctr.webPreview.getPreview(data)

    return reply.cwSendSuccess({
      data: {
        preview
      }
    })
  }
}

module.exports = WebPreviewActions
