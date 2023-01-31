module.exports = {
  getPreview: {
    schema: {
      security: [
        {
          authorization: []
        }
      ],
      body: {
        type: 'object',
        required: ['link'],
        properties: {
          link: {
            type: 'string'
          }
        }
      }
    }
  }
}
