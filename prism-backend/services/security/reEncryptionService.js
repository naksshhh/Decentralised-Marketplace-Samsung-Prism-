const Proxy = require('../../proxy re-encryption/src/proxy');
const CryptoJS = require('crypto-js');

class ReEncryptionService {
    constructor() {
        this.options = {
            iv: CryptoJS.enc.Utf8.parse("0000000000000000"),
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        };
    }

    encryptData(publicKey, data) {
        const pubKey = Proxy.public_key_from_bytes(Proxy.from_hex(publicKey));
        const cp = Proxy.encapsulate(pubKey);
        const symKey = Proxy.to_hex(cp.symmetric_key.to_bytes());

        const key = CryptoJS.enc.Utf8.parse(symKey);
        const encrypted = CryptoJS.AES.encrypt(data, key, this.options);

        return {
            key: Proxy.to_hex(cp.capsule.to_bytes()),
            cipher: encrypted.toString()
        };
    }

    decryptData(privateKey, obj) {
        const priKey = Proxy.private_key_from_bytes(Proxy.from_hex(privateKey));
        const capsule = Proxy.capsule_from_bytes(Proxy.from_hex(obj.key));
        const symKey = Proxy.decapsulate(capsule, priKey);

        const key = CryptoJS.enc.Utf8.parse(Proxy.to_hex(symKey.to_bytes()));
        const decrypted = CryptoJS.AES.decrypt(obj.cipher, key, this.options);

        return decrypted.toString(CryptoJS.enc.Utf8);
    }

    generateReEncryptionKey(privateKey, publicKey) {
        const priKey = Proxy.private_key_from_bytes(Proxy.from_hex(privateKey));
        const pubKey = Proxy.public_key_from_bytes(Proxy.from_hex(publicKey));

        const rk = Proxy.generate_re_encryption_key(priKey, pubKey);
        return Proxy.to_hex(rk.to_bytes());
    }

    reEncrypt(Rk, obj) {
        const rk = Proxy.re_encryption_key_from_bytes(Proxy.from_hex(Rk));
        const capsule = Proxy.capsule_from_bytes(Proxy.from_hex(obj.key));
        const re_capsule = Proxy.re_encrypt_capsule(capsule, rk);
        
        return {
            ...obj,
            key: Proxy.to_hex(re_capsule.to_bytes())
        };
    }

    async processFile(inputFile, outputFile, operation, keys) {
        const fs = require('fs');
        const data = fs.readFileSync(inputFile, 'utf8');
        
        let result;
        switch(operation) {
            case 'encrypt':
                result = this.encryptData(keys.publicKey, data);
                break;
            case 'decrypt':
                result = this.decryptData(keys.privateKey, data);
                break;
            case 'reEncrypt':
                result = this.reEncrypt(keys.reEncryptionKey, data);
                break;
            default:
                throw new Error('Invalid operation');
        }

        fs.writeFileSync(outputFile, JSON.stringify(result));
        return result;
    }
}

module.exports = new ReEncryptionService(); 