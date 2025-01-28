const path = require('path');

module.exports = {
  target: 'node',
  entry: './src/index.js',
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'dist'),
    libraryTarget: 'commonjs2'
  },
  mode: 'production',
  optimization: {
    minimize: false
  },
  performance: {
    hints: false
  },
  externals: {
    'aws-sdk': 'aws-sdk',
    'pg-native': 'pg-native'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  }
};
