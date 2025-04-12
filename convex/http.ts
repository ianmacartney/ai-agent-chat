import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { sendMessageHttpStream } from "./chat";

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({
  path: "/streamText",
  method: "POST",
  handler: sendMessageHttpStream,
});
export default http;
