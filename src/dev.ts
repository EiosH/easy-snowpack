import Koa from "koa";
import koaStatic from "koa-static";

import { openURL } from "./utils/index";

export const run = async (projectPath: string, workspacePath: string) => {
  const app = new Koa();

  app.use(koaStatic(workspacePath));

  app.listen(3000, () => {
    console.log("ok");
    openURL("http://localhost:3000");
  });
};
