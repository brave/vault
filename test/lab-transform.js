var Babel = require('babel-eslint/node_modules/babel-core')
require('babel-polyfill')

// setting "babelrc: false" has no effect below
Babel.options.presets = { type: 'list' }

module.exports = [
  {
    ext: '.js', transform: function (content, filename) {
      if (filename.indexOf('node_modules') === -1) {
        var result = Babel.transform(content, { sourceMap: 'inline',
                                                filename: filename,
                                                sourceFileName: filename,
                                                babelrc: false
                                              })
        return result.code
      }

      return content
    }
  }
]
