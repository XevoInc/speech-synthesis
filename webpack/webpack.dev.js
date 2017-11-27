const webpack = require('webpack');
const merge = require('webpack-merge');

const baseConfig = require('./webpack.base');

module.exports = merge(baseConfig, {
  devtool: 'cheap-module-source-map',
  module: {
    rules: [{
      enforce: 'pre',
      test: /\.js$/,
      loader: 'source-map-loader',
      exclude: /node_modules/,
    }, ],
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': process.env.NODE_ENV
    }),
  ],
  devServer: {
    headers: { "Access-Control-Allow-Origin": "*" },
    host: process.env.HOST || 'localhost',
    disableHostCheck: true,
    contentBase: './public',
    inline: true,
    hot: true,
    compress: true,
    open: true,
    overlay: true,
  },
});
