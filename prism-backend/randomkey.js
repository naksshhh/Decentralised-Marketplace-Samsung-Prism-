const { Wallet } = require("ethers");

// Generate a random wallet
const wallet = Wallet.createRandom();
console.log("Public Key:", wallet.publicKey); // This will be a valid uncompressed public key
