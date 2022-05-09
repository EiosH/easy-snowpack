import Koa from "koa";
import koaStatic from "koa-static";
import EventEmitter from "events";
import * as WebSocket from "ws";

import { openURL } from "./utils/index";

const eventEmitter = new EventEmitter();
const WebSocketServer = WebSocket.Server;

const startHmr = () => {
  const wss = new WebSocketServer({
    port: 443,
  });

  wss.on("connection", (ws) => {
    const listener = () => {
      ws.send("reload");
    };

    ws.on("close", () => {
      eventEmitter.removeListener("reload", listener);
    });

    eventEmitter.on("reload", listener);
  });
};

const notifyReload = () => {
  eventEmitter.emit("reload");
};

const run = async (workspacePath: string) => {
  const app = new Koa();

  app.use(koaStatic(workspacePath));

  app.listen(3000, () => {
    console.log("ok");
    openURL("http://localhost:3000");
  });

  startHmr();
};

export { run, notifyReload };
