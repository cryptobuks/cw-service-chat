const { db } = require('@cowellness/cw-micro-service')()

const Schema = db.chat.Schema

const actions = new Schema(
  {
    label: String,
    tooltip: String,
    showTo: Array,
    active: {
      type: Boolean,
      default: true
    },
    frontend: Object,
    backend: Object
  },
  { timestamps: true }
)

module.exports = actions
