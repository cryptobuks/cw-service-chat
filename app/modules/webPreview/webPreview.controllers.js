const { log, redis } = require('@cowellness/cw-micro-service')()
const metascraper = require('metascraper')([
  require('metascraper-description')(),
  require('metascraper-image')(),
  require('metascraper-title')(),
  require('metascraper-url')()
])
const got = require('got')
const fetch = require('node-fetch')
const md5 = require('md5')
const sharp = require('sharp')
const urlRegexSafe = require('url-regex-safe')
/**
 * @class WebpreviewController
 * @classdesc Controller Webpreview
 */
class WebpreviewController {
  /**
   * get a web preview meta of link
   * @param {*} data {link}
   */
  async getPreview ({ link }) {
    try {
      const previewData = await this.getPreviewByUrl(link)

      if (previewData) {
        return previewData
      }
      if (!link.startsWith('http://') || !link.startsWith('https://')) {
        link = `http://${link}`
      }
      if (!link.match(urlRegexSafe())) {
        return null
      }
      const { body: html, url } = await got(link, { timeout: 1000 })
      const metadata = await metascraper({ html, url })
      const data = {
        url: link,
        meta: {
          title: metadata.title,
          description: metadata.description
        },
        image: null,
        createdAt: Date.now()
      }

      if (metadata.image) {
        const imageBuffer = await this.imageToBuffer(metadata.image)
        const bufferData = await sharp(imageBuffer)
          .resize(90, 90)
          .jpeg({ quality: 70 })
          .toBuffer()

        data.image = bufferData.toString('base64')
      }

      await this.setPreview(link, data)
      return data
    } catch (error) {
      return null
    }
  }

  /**
   * convert url to buffer
   * @param {*} url
   * @returns buffer
   */
  imageToBuffer (url) {
    return fetch(url)
      .then(response => response.buffer())
      .catch(error => {
        log.error(`webPreview:imageToBase64:error: ${error}`)
        return null
      })
  }

  /**
   * generate a redis key
   * @param {*} url
   * @returns redis key string
   */
  getKey (url) {
    return 'url:' + md5(url)
  }

  /**
   * get a preview data from redis
   * @param {*} url
   * @returns redis data
   */
  async getPreviewByUrl (url) {
    let data = redis.get(this.getKey(url))
    try {
      data = JSON.parse(data)
    } catch (error) {
      data = null
    }
    return data
  }

  /**
   * save preview data in redis
   * @param {*} url
   * @param {*} data
   */
  setPreview (url, data) {
    const expire = 60 * 60 * 24 * 30 // 1 month in second
    return redis.set(this.getKey(url), JSON.stringify(data), 'EX', expire)
  }
}

module.exports = WebpreviewController
