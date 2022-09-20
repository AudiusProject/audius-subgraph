require('babel-register')
require('babel-polyfill')
const HDWalletProvider = require('truffle-hdwallet-provider')

module.exports = {
  networks: {
    development: {
      host: '127.0.0.1',
      port: 8546,
      network_id: '*',
    },
    goerli: {
      provider: function() {
        return new HDWalletProvider(
          process.env.MNEMONIC,
          `https://goerli.infura.io/v3/${process.env.GOERLI_INFURA_API_KEY}`
        )
      },
      network_id: '5',
    },
  },
  compilers: {
    solc: {
      version: '0.4.25'    // Fetch exact version from solc-bin (default: truffle's version)
    }
  }
}
