const path = require('path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    entry: {
        app: "./src/polyfill.js",
    },
    output: {
        path: __dirname + "/dist",
        filename: "src/polyfill.js"
    },
    resolve: {
        extensions: ['.js'],
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    query: {
                        presets: ['env']
                    }
                }
            },
            {
                test: /\.html$/,
                use: {
                    loader: 'html-loader',
                }
            }
        ],
    },
    plugins: [
        new webpack.HotModuleReplacementPlugin(),
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': process.env.NODE_ENV
        }),
        new CopyWebpackPlugin([
            { from: 'public' },
        ]),
        new HtmlWebpackPlugin({
            template: './index.html',
            minify: {
                removeComments: false,
                collapseWhitespace: false,
                minifyCSS: false,
            },
            inject: false,
        }),
        new webpack.EnvironmentPlugin({
            'NODE_ENV': 'development'
        }),
    ],
    node: {
        fs: 'empty',
        net: 'empty',
        tls: 'empty',
    },
};
