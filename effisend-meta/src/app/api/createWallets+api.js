import { fetch } from 'expo/fetch';
export async function POST(request) {
  const body = await request.json();
  const result = await new Promise(async (resolve) => {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");

    const raw = JSON.stringify({
      kind: body.kind,
      address: body.address,
    });

    const requestOptions = {
      method: "POST",
      headers: myHeaders,
      body: raw,
      redirect: "follow",
    };
    fetch(`${process.env.CREATE_FACE_ID_URL_API}`, requestOptions)
      .then((response) => response.json())
      .then((result) => {
        resolve(result);
      })
      .catch((e) => {
        console.log(e);
      });
  });
  return Response.json({ result });
}
