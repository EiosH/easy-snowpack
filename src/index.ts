import { run } from "./dev";
import path from "path";
import { readFileSync, writeFileSync, watch } from "fs";
import jscodeshift from "jscodeshift";
import { load } from "cheerio";
import esbuild from "esbuild";

import { isLibrary, makeDir, deleteDir, copyDir } from "./utils";

const projectPath = process.cwd();
const workspacePath = path.join(projectPath, "../workspace");
const modulePath = "easy-snowpack";

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
  const indexPath = path.join(projectPath, "./index.html");

  const html = readFileSync(indexPath).toString();

  const $ = load(html);

  $("html")
    .find("script")
    .each((_, script) => {
      const { src, type } = script.attribs || {};
      if (type === "module") {
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

    let modified = false;

    value = jscodeshift(value)
      .find(jscodeshift.ImportDeclaration)
      .forEach((path) => {
        const name = path.value.source.value;

        if (isLibrary(name as string)) {
          const moduleName = `../${modulePath}/${name}.js`;
          path.value.source.value = moduleName;
          modified = true;
        }
      })
      .toSource();

    if (modified) {
      writeFileSync(path.join(workspacePath, indexPath), value);
    }
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

    const esmSource = await getEsm(source);

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

  await generateWorkspace();

  await copyDir(
    `\`ls ${projectPath} | grep -v node_modules | xargs\``,
    workspacePath
  );
};

const analyze = async () => {
  await transform();
  await generater();
};

const init = async () => {
  await ready();
  await analyze();
  await run(projectPath, workspacePath);
};

const watcher = async () => {
  await init();

  watch(projectPath, { recursive: true }, () => {
    analyze();
  });
};

watcher();
