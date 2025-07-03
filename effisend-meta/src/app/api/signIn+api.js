import { fetch } from "expo/fetch";

async function signIn(body) {
  return new Promise((resolve) => {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    const raw = JSON.stringify(body);
    const requestOptions = {
      method: "POST",
      headers: myHeaders,
      body: raw,
      redirect: "follow",
    };

    fetch(process.env.SIGN_IN_URL_API, requestOptions)
      .then((response) => response.json())
      .then((result) => resolve(result))
      .catch((error) => {
        console.log(error);
        resolve(null);
      });
  });
}

export async function POST(request) {
  const body = await request.json();
  const result = await signIn(body);
  return Response.json({ result });
}
