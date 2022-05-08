import { spawn, exec } from "child_process";

import { promisify } from "util";

const execute = promisify(exec);

const openURL = function (url: string) {
  // 判断平台
  switch (process.platform) {
    // Mac 使用open
    case "darwin":
      spawn("open", [url]);
      break;
    // Windows使用start
    case "win32":
      spawn("start", [url]);
      break;
    // Linux等使用xdg-open
    default:
      spawn("xdg-open", [url]);
  }
};

const isLibrary = (name: string) => {
  return !name.startsWith(".");
};

const deleteDir = async (path: string) => {
  return execute(`rm -rf ${path}`);
};

const copyDir = async (src: string, target: string) => {
  return execute(`cp -r ${src} ${target}`);
};

const makeDir = async (path: string) => {
  return execute(`mkdir ${path}`);
};

export { openURL, isLibrary, copyDir, makeDir, deleteDir };
