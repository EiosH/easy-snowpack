import path from "path";
import { readFileSync, writeFileSync, watch } from "fs";
import jscodeshift from "jscodeshift";
import { load } from "cheerio";
import esbuild from "esbuild";

import { run, notifyReload } from "./dev";
import { isLibrary, makeDir, deleteDir, copyDir } from "./utils";

const projectPath = process.cwd();
const workspacePath = path.join(projectPath, "../workspace");
const indexPath = path.join(projectPath, "./index.html");
const modulePath = "easy-snowpack";

const memoLibrary: Record<string, boolean> = {};

const getDependencies = () => {
  const projectPkgPath = path.join(projectPath, "./package.json");

  const dependenciesList = [];

  const dependencies = JSON.parse(
    readFileSync(projectPkgPath).toString()
  ).dependencies;

  for (let dependency in dependencies) {
    dependenciesList.push(dependency);
  }

  return dependenciesList;
};

const gatherIndex = () => {
  const jsPathList: string[] = [];
  const html = readFileSync(indexPath).toString();
  const $ = load(html);

  $("html")
    .find("script")
    .each((_, script) => {
      const { src, type } = script.attribs || {};
      if (src && type === "module") {
        jsPathList.push(src);
      }
    });

  return jsPathList;
};

const transform = async () => {
  const indexPathList = gatherIndex();

  indexPathList.forEach((indexPath) => {
    const filePath = path.join(projectPath, indexPath);
    let value = readFileSync(filePath).toString();

    value = jscodeshift(value)
      .find(jscodeshift.ImportDeclaration)
      .forEach((path) => {
        const name = path.value.source.value;

        if (isLibrary(name as string)) {
          const moduleName = `../${modulePath}/${name}.js`;
          path.value.source.value = moduleName;
        } else {
          path.value.source.value = `${name}.js`;
        }
      })
      .toSource();

    writeFileSync(path.join(workspacePath, indexPath), value);
  });
};

const generater = async () => {
  const dependencies = getDependencies();

  const getEsm = async (source: string) => {
    const { code } = await esbuild.transform(source, {
      format: "esm",
    });

    return code;
  };

  dependencies.forEach(async (dependency) => {
    const source = readFileSync(
      path.join(projectPath, `./node_modules/${dependency}/index.js`)
    ).toString();

    if (memoLibrary[dependency]) {
      return;
    }

    const esmSource = await getEsm(source);

    memoLibrary[dependency] = true;

    writeFileSync(
      path.join(workspacePath, `/${modulePath}/${dependency}.js`),
      esmSource
    );
  });
};

const ready = async () => {
  const generateWorkspace = async () => {
    await deleteDir(workspacePath);
    await makeDir(workspacePath);
    await makeDir(path.join(workspacePath, modulePath));
  };

  const injectHmr = () => {
    const html = readFileSync(indexPath).toString();

    const $ = load(html);

    $("head").append(`
    <script>
    const ws = new WebSocket("ws://localhost:443");
  
    ws.onopen = ()=>{
      console.log("[ESM-HMR] listening for file changes...");
    }
    ws.onmessage = ()=>{
      console.log("[ESM-HMR] message: reload");
      location.reload();
    }
  
    </script>
    `);

    writeFileSync(path.join(workspacePath, "./index.html"), $.html());
  };

  await generateWorkspace();

  await copyDir(
    `\`ls ${projectPath} | grep -v node_modules | xargs\``,
    workspacePath
  );

  injectHmr();
};

const analyze = async () => {
  await transform();
  await generater();
};

const init = async () => {
  await ready();
  await analyze();
  await run(workspacePath);
};

const watcher = async () => {
  await init();

  watch(projectPath, { recursive: true }, async () => {
    await analyze();
    notifyReload();
  });
};

watcher();
