import fastify from "fastify";

const app = fastify();

app.get("/test", () => {
  return "Hue";
});

app.listen({ port: 3333 }).then(() => {
  console.log("Server running!");
});
