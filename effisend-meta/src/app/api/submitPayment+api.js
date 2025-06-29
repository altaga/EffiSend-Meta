import { fetch } from "expo/fetch";

async function submitPayment(jsonBody) {
  const myHeaders = new Headers();
  myHeaders.append("Content-Type", "application/json");
  const raw = JSON.stringify(jsonBody);
  const requestOptions = {
    method: "POST",
    headers: myHeaders,
    body: raw,
    redirect: "follow",
  };
  return new Promise((resolve) => {
    fetch(`${process.env.SUBMIT_PAYMENT_URL_API}`, requestOptions)
      .then((response) => response.json())
      .then((result) => resolve(result))
      .catch(() => resolve(null));
  });
}

export async function POST(request) {
  const body = await request.json();
  const result = await submitPayment(body);
  return Response.json({ result });
}
