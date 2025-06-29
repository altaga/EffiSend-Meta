export function GET(request) {
  console.log(process.env.CREATE_FACE_ID_URL_API);
  return Response.json({ hello: "world" });
}
