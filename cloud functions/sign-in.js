const functions = require('@google-cloud/functions-framework');
const Firestore = require("@google-cloud/firestore");
const { ethers } = require("ethers");
const message = "Hello EffiSend";

const db = new Firestore({
    projectId: "xxxxxxxxxxxxx",
    keyFilename: "credential.json",
});

functions.http('helloHttp', async (req, res) => {
  try {
    const { address, signature } = req.body;
    const recoveredAddress = ethers.utils.verifyMessage(message, signature);
    if (recoveredAddress.toLowerCase() === address.toLowerCase()) {
      const collection = db.collection("DID");
      const query = await collection.where("address", "==", address).get();
      if (query.empty) {
        res.send({
          e: null,
          result: "Not User",
        });
      } else {
        res.send({
          e: null,
          result: query.docs[0].data(),
        });
      }
    } else {
      res.send({
        e: "Bad Signature",
        result: false,
      });
    }
  }
  catch (e) {
    console.log(e);
    res.send({
      e: "Bad Request",
      result: null,
    });
  }
});
