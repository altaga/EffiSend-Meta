
import { fetch } from "expo/fetch";
async function faceRegister(image, address) {
  const myHeaders = new Headers();
  myHeaders.append("X-API-Key", process.env.AI_URL_API_KEY);
  myHeaders.append("Content-Type", "application/json");
  const raw = JSON.stringify({
    address,
    image,
  });
  const requestOptions = {
    method: "POST",
    headers: myHeaders,
    body: raw,
    redirect: "follow",
  };
  return new Promise((resolve) => {
    fetch(`${process.env.CREATE_FACE_AI_URL_API}`, requestOptions)
      .then((response) => response.json())
      .then((result) => resolve(result))
      .catch(() => resolve(null));
  });
}

export async function POST(request) {
  const body = await request.json();
  const { result } = await faceRegister(body.image, body.address);
  return Response.json({ result });
}
