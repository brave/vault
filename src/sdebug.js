/* a wrapper around debug() to add structured data logging, viz., https://tools.ietf.org/html/rfc5424#section-6.3

   soon to be an open source module...

 */

var path = require('path')
var slugify = require('transliteration').slugify
var underscore = require('underscore')

exports = module.exports = function (namespace) {
  var sdebug
  var debug = require('debug')
  var options = {
    nilvalue: '-',
    lowercase: false,
    separator: '_',
    pen: 1104
  }
  var initial = ''

  var sdelement = function (params) {
    var sdata = ''

    var sdname = function (name) {
      name = slugify(name, options)
      if (name.length > 32) { name = name.slice(0, 32) }

      return name
    }

    var sdvalue = function (param) {
      var value = ''

      param.toString().split('').forEach(function (c) {
        value += '\\"]%'.indexOf(c) !== -1 ? encodeURI(c) : c
      })
      return value
    }

    underscore.keys(params || {}).forEach(function (name) {
      var value = params[name]
      var keys = underscore.keys(value)

      if (keys.length === 0) { return }

      sdata += '[' + (name.indexOf('@') !== -1 ? name : sdname(name)) + '@' + options.pen
      keys.forEach(function (pname) {
        if ((typeof value[pname] !== 'string') &&
            (typeof value[pname] !== 'number') &&
            (typeof value[pname] !== 'boolean')) { return }

        sdata += ' ' + sdname(pname) + '="' + sdvalue(value[pname]) + '"'
      })
      sdata += ']'
    })

    return sdata
  }

  debug.formatArgs = function () {
    var args = [ '' ]
    var name = this.namespace
    var prefix = initial

    if (this.useColors) { name = '\u001b[3' + this.color + ';1m' + name + '\u001b[0m' }

    underscore.rest(arguments).forEach(function (arg) {
      var truths, value
      var keys = underscore.keys(arg)

      if (keys[0] === 'sdebug') {
        prefix = sdelement(arg.sdebug)
      } else if (keys[0] !== 'tags') {
        args.push(arg)
      } else {
        value = arg.tags
        if (underscore.isArray(value)) {
          truths = underscore.times(value.length, function () { return true })
          arg.tags = underscore.object(value, truths)
        }
        prefix += sdelement(arg)
      }
    })
    if (initial !== prefix) { prefix = ' ' + prefix }
    args[0] = name + prefix + ' ' + arguments[0]

    return args
  }

  sdebug = new (require('debug'))(path.parse(namespace).name)

  sdebug.config = function (config) {
    options = underscore.extend(options, config)

    return sdebug
  }

  sdebug.initialize = function (params) {
    var sdata = ''

    sdata += sdelement(params)
    if (sdata === '') { sdata = options.nilvalue + ' ' }
    initial = ' ' + sdata

    return sdebug
  }

  return sdebug
}
