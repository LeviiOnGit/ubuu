const path = require('path');

module.exports = {
  entry: './libScript.js',
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist'),
  },
};