const express = require("express");
const { ethers } = require("ethers"); // Import ethers.js
const { uploadToIPFS } = require("../config/ipfs");
const { contract, provider } = require("../config/web3");
const router = express.Router();
const EC = require("elliptic").ec;
const CryptoJS = require("crypto-js");
const ec = new EC("secp256k1");

function encryptData(dataset, publicKey) {
  try {
    // Ensure the public key is valid
    if (!publicKey.startsWith("04") && !publicKey.startsWith("02") && !publicKey.startsWith("03")) {
      throw new Error("Invalid public key format. Expected an uncompressed (04...) or compressed (02/03...) key.");
    }

    const key = ec.keyFromPublic(publicKey, "hex"); // Convert to EC key
    const sharedSecret = key.getPublic().encode("hex").slice(0, 32); // First 32 bytes
    return CryptoJS.AES.encrypt(dataset, sharedSecret).toString();
  } catch (error) {
    console.error("Encryption failed:", error.message);
    throw new Error("Encryption failed: " + error.message);
  }
}

function decryptData(encryptedData, privateKey) {
  const key = ec.keyFromPrivate(privateKey, "hex");
  const sharedSecret = key.getPublic().encode("hex").slice(0, 32);
  const bytes = CryptoJS.AES.decrypt(encryptedData, sharedSecret);
  return bytes.toString(CryptoJS.enc.Utf8);
}

router.get("/totalDatasets", async (req, res) => {
  try {
    console.log("Fetching dataset count...");
    const total = await contract.datasetCounter(); // Call contract function
    res.json({ totalDatasets: total.toString() });
  } catch (error) {
    console.error("Error fetching dataset count:", error);
    res.status(500).json({ error: "Failed to fetch dataset count" });
  }
});

router.post("/upload", async (req, res) => {
  try {
    const { dataset, price, metadata, buyerPublicKey } = req.body;
    if (!dataset || !price || !metadata || !buyerPublicKey) return res.status(400).json({ error: "Missing data" });

    if (!buyerPublicKey.startsWith("04") && !buyerPublicKey.startsWith("02") && !buyerPublicKey.startsWith("03")) {
      return res.status(400).json({ error: "Invalid public key format. Ensure it starts with 04, 02, or 03." });
    }

    console.log("Encrypting dataset with buyer’s public key...");
    const encryptedDataset = encryptData(dataset, buyerPublicKey);

    console.log("Uploading encrypted dataset to IPFS...");
    const ipfsHash = await uploadToIPFS({ encryptedDataset });

    console.log("Converting price to Wei...");
    const priceInWei = ethers.parseEther(price.toString());

    console.log("Storing IPFS hash on blockchain...");
    const tx = await contract.uploadDataset(ipfsHash, price, metadata);
    await tx.wait();

    res.json({ message: "Encrypted dataset uploaded", ipfsHash, transactionHash: tx.hash });
  } catch (error) {
    console.error("Upload failed:", error);
    res.status(500).json({ error: "Dataset upload failed" });
  }
});

router.post("/purchase", async (req, res) => {
  try {
    const { datasetId, buyerPrivateKey } = req.body;
    if (!datasetId || !buyerPrivateKey) return res.status(400).json({ error: "Missing datasetId or buyerPrivateKey" });

    // Connect buyer's wallet
    const buyerWallet = new ethers.Wallet(buyerPrivateKey, provider);
    const buyerContract = contract.connect(buyerWallet);

    console.log("Fetching dataset details...");
    const dataset = await contract.getDataset(datasetId);

    const price = dataset[2]; // Price from contract
    const isAvailable = dataset[3]; // Availability status

    if (!isAvailable) return res.status(400).json({ error: "Dataset not available for purchase" });

    console.log("Processing transaction...");
    const tx = await buyerContract.purchaseDataset(datasetId, { value: price });
    await tx.wait();

    console.log("Purchase Successful:", tx.hash);
    res.json({ message: "Purchase successful", txHash: tx.hash });
  } catch (error) {
    console.error("Purchase failed:", error);
    res.status(500).json({ error: error.message });
  }
});

  
  
  router.get("/hasAccess/:datasetId/:userAddress", async (req, res) => {
    try {
      const { datasetId, userAddress } = req.params;
      const hasAccess = await contract.hasAccess(datasetId, userAddress);
      res.json({ hasAccess });
    } catch (error) {
      console.error("Error checking access:", error);
      res.status(500).json({ error: "Failed to check access" });
    }
  });
  
  router.get("/retrieve/:datasetId/:buyerPrivateKey", async (req, res) => {
    try {
      const { datasetId, buyerPrivateKey } = req.params;
  
      console.log("Checking if buyer has access...");
      const hasAccess = await contract.hasAccess(datasetId, wallet.address);
  
      if (!hasAccess) return res.status(403).json({ error: "Access denied. You haven't purchased this dataset." });
  
      console.log("Fetching encrypted dataset from IPFS...");
      const dataset = await contract.getDataset(datasetId);
      const encryptedData = await fetch(`https://ipfs.io/ipfs/${dataset[1]}`).then((res) => res.text());
  
      console.log("Decrypting dataset...");
      const decryptedData = decryptData(encryptedData, buyerPrivateKey);
  
      res.json({ message: "Dataset retrieved", dataset: decryptedData });
    } catch (error) {
      console.error("Retrieval failed:", error);
      res.status(500).json({ error: "Dataset retrieval failed" });
    }
  });
  
  
  

module.exports = router;
