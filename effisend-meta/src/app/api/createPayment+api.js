import { fetch } from "expo/fetch";

async function createPayment(nonce, user) {
  const myHeaders = new Headers();
  myHeaders.append("Content-Type", "application/json");
  const raw = JSON.stringify({
    nonce,
    user,
  });
  const requestOptions = {
    method: "POST",
    headers: myHeaders,
    body: raw,
    redirect: "follow",
  };
  return new Promise((resolve) => {
    fetch(`${process.env.CREATE_PAYMENT_URL_API}`, requestOptions)
      .then((response) => response.json())
      .then((result) => resolve(result))
      .catch(() => resolve(null));
  });
}

export async function POST(request) {
  const body = await request.json();
  const result = await createPayment(body.nonce, body.user);
  return Response.json({ result });
}
