// keys.js -- figure out what set of credentials to return

if (process.env.NODE_ENV === 'production') {
    // We are in production - return prod set of keys
    module.exports = require('./prod');
} else {
    // We are in dev - return dev set of keys
    module.exports = require('./dev');
}