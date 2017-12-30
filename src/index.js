import axios from 'axios'
import { deserialise, error, query, serialise } from './util'

const kitsu = 'https://kitsu.io/api/edge'
const jsonAPI = 'application/vnd.api+json'
const jsonAPIHeader = { 'accept': jsonAPI, 'content-type': jsonAPI }

/**
 * A simple framework agnostic JSON-API client JSON API
 *
 * @name Kitsu
 * @param {Object} options Options
 * @param {string} options.baseURL Set the API endpoint (default `https://kitsu.io/api/edge`)
 * @param {Object} options.headers Additional headers to send with requests
 * @param {boolean} options.decamelize If `true`, `/libraryEntries` will become `/library-entries` in the URL request (default `true`)
 * @param {boolean} options.pluralize If `true`, `type` will be pluralized in post, patch and delete requests - `user` -> `users` (default `true`)
 * @param {number} options.timeout Set the request timeout in milliseconds (default `30000`)
 *
 * @example
 * // If using Kitsu.io's API
 * const api = new Kitsu()
 *
 * @example
 * // If using another API server
 * const api = new Kitsu({
 *   baseURL: 'https://api.example.org/2'
 * })
 *
 * @example
 * // Set a `user-agent` and an `authorization` token
 * const api = new Kitsu({
 *   headers: {
 *     'User-Agent': 'MyApp/1.0.0 (github.com/username/repo)',
 *     Authorization: 'Bearer 1234567890'
 *   }
 * })
 */
export default class Kitsu {
  constructor (options = {}) {
    this.baseURL = options.baseURL || kitsu
    this.headers = Object.assign(options.headers ? options.headers : {}, {
      'accept': 'application/vnd.api+json',
      'content-type': 'application/vnd.api+json'
    })
    this.axios = axios.create({
      baseURL: this.baseURL,
      timeout: options.timeout || 30000,
      headers: this.headers
    })

    this.headers = Object.assign({}, options.headers, jsonAPIHeader)
    axios.defaults.baseURL = options.baseURL || kitsu
    axios.defaults.timeout = options.timeout || 30000
  }

  /**
   * Get the current headers or add additional headers
   *
   * @memberof Kitsu
   * @returns {Object} All the current headers
   *
   * @example
   * // Receive all the headers
   * api.headers
   *
   * @example
   * // Receive a specific header
   * api.headers['User-Agent']
   *
   * @example
   * // Add or update a header
   * api.headers['Authorization'] = 'Bearer 1234567890'
   */
  headers () {
    return this.headers
  }

  /**
   * Check if the client is authenticated (oAuth2/Authorization header)
   *
   * @memberof Kitsu
   * @returns {boolean}
   *
   * @example
   * if (api.isAuth) console.log('Authenticated')
   * else console.log('Not authenticated')
   */
  get isAuth () {
    return Boolean(this.headers.Authorization)
  }

  /**
   * Fetch resources
   * Aliases: `fetch`
   *
   * @memberof Kitsu
   * @param {string} model Model to fetch data from
   * @param {Object} params JSON-API request queries
   * @param {Object} params.page jsonapi.org/format/#fetching-pagination
   * @param {number} params.page.limit Number of resources to return in request (Max `20` for Kitsu.io except on `libraryEntries` which has a max of `500`)
   * @param {number} params.page.offset Number of resources to offset the dataset by
   * @param {Object} params.fields Return a sparse fieldset with only the included attributes/relationships jsonapi.org/format/#fetching-sparse-fieldsets
   * @param {Object} params.filter Filter dataset by attribute values jsonapi.org/format/#fetching-filtering
   * @param {string} params.sort Sort dataset by one or more comma separated attributes (prepend `-` for descending order) jsonapi.org/format/#fetching-sorting
   * @param {string} params.include Include relationship data jsonapi.org/format/#fetching-includes
   * @param {Object} headers Additional headers to send with request
   * @returns {Object} JSON-parsed response
   *
   * @example
   * // Get a specific user's name & birthday
   * api.get('users', {
   *   fields: {
   *     users: 'name,birthday'
   *   },
   *   filter: {
   *     name: 'wopian'
   *   }
   * })
   *
   * @example
   * // Get a collection of anime resources and their categories
   * api.get('anime', {
   *   include: 'categories'
   * })
   *
   * @example
   * // Get a single resource and its relationships by ID (method one)
   * api.get('anime', {
   *   include: 'categories',
   *   filter: { id: '2' }
   * })
   *
   * @example
   * // Get a single resource and its relationships by ID (method two)
   * api.get('anime/2', {
   *   include: 'categories'
   * })
   *
   * @example
   * // Get a resource's relationship data only
   * api.get('anime/2/categories')
   */
  async get (model, params = {}, headers = {}) {
    try {
      let { data } = await this.axios.get(plural(kebab(model)), {
        params,
        paramsSerializer: p => query(p),
        headers: Object.assign(this.headers, headers, jsonAPIHeader)
      })

      return deserialise(data)
    } catch (E) {
      return error(E)
    }
  }

  /**
   * Update a resource
   * Aliases: `update`
   *
   * @memberof Kitsu
   * @param {string} model Model to update data in
   * @param {Object} body Data to send in the request
   * @param {Object} headers Additional headers to send with request
   * @returns {Object} JSON-parsed response
   *
   * @example
   * // Update a user's post (Note: For Kitsu.io, posts cannot be edited 30 minutes after creation)
   * api.update('posts', {
   *   id: '12345678',
   *   content: 'Goodbye World'
   * })
   */
  async patch (model, body, headers = {}) {
    try {
      headers = Object.assign(this.headers, headers, jsonAPIHeader)
      if (!headers.Authorization) throw new Error('Not logged in')
      if (typeof body.id === 'undefined') throw new Error('Updating a resource requires an ID')

      let { data } = await this.axios.patch(`${plural(kebab(model))}/${body.id}`, {
        data: (await serialise(model, body, 'PATCH')).data,
        headers
      })

      return data
    } catch (E) {
      return error(E)
    }
  }

  /**
   * Create a new resource
   * Aliases: `create`
   *
   * @memberof Kitsu
   * @param {string} model Model to create a resource under
   * @param {Object} body Data to send in the request
   * @param {Object} headers Additional headers to send with request
   * @returns {Object} JSON-parsed response
   *
   * @example
   * // Post to a user's own profile
   * api.create('posts', {
   *   content: 'Hello World',
   *   targetUser: {
   *     id: '42603',
   *     type: 'users'
   *   },
   *   user: {
   *     id: '42603',
   *     type: 'users'
   *   }
   * })
   */
  async post (model, body, headers = {}) {
    try {
      headers = Object.assign(this.headers, headers, jsonAPIHeader)
      if (!headers.Authorization) throw new Error('Not logged in')

      let { data } = await this.axios.post(plural(kebab(model)), {
        data: (await serialise(model, body)).data,
        headers
      })

      return data
    } catch (E) {
      return error(E)
    }
  }

  /**
   * Remove a resource
   *
   * @memberof Kitsu
   * @param {string} model Model to remove data from
   * @param {string|number} id Resource ID to remove
   * @param {Object} headers Additional headers to send with request
   * @returns {Object} JSON-parsed response
   *
   * @example
   * // Delete a user's post
   * api.remove('posts', 123)
   */
  async remove (model, id, headers = {}) {
    try {
      headers = Object.assign(this.headers, headers, jsonAPIHeader)
      if (!headers.Authorization) throw new Error('Not logged in')

      let { data } = await this.axios.delete(`${plural(kebab(model))}/${id}`, {
        data: (await serialise(model, { id }, 'DELETE')).data,
        headers
      })

      return data
    } catch (E) {
      return error(E)
    }
  }

  /**
   * Get the authenticated user's data
   * Note: Requires the JSON:API server to support `filter[self]=true`
   *
   * @memberof Kitsu
   * @param {Object} params JSON-API request queries
   * @param {Object} params.fields Return a sparse fieldset with only the included attributes/relationships jsonapi.org/format/#fetching-sparse-fieldsets
   * @param {string} params.include Include relationship data jsonapi.org/format/#fetching-includes
   * @param {Object} headers Additional headers to send with request
   * @returns {Object} JSON-parsed response
   *
   * @example
   * // Receive all attributes
   * api.self()
   *
   * @example
   * // Receive a sparse fieldset
   * api.self({
   *   fields: 'name,birthday'
   * })
   */
  async self (params = {}, headers = {}) {
    try {
      const { data } = await this.get('users', Object.assign({ filter: { self: true } }, params), headers)
      return data[0]
    } catch (E) {
      return error(E)
    }
  }

  fetch = this.get
  update = this.patch
  create = this.post
}
