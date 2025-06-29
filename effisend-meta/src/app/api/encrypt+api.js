import { CloudPublicKeyEncryption } from "../../core/constants";
import Crypto from "crypto";

function encryptData(data) {
  const encrypted = Crypto.publicEncrypt(
    {
      key: CloudPublicKeyEncryption,
    },
    Buffer.from(data, "utf8")
  );
  return encrypted.toString("base64");
}

export async function POST(request) {
  const body = await request.json();
  const data = encryptData(body.data);
  return Response.json({ data });
}
