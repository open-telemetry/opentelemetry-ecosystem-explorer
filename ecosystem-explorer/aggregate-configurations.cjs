const fs = require("fs");
const path = require("path");

const INSTRUMENTATIONS_DIR = path.join(
  __dirname,
  "public",
  "data",
  "javaagent",
  "instrumentations"
);
const OUTPUT_FILE = path.join(
  __dirname,
  "public",
  "data",
  "javaagent",
  "global-configurations.json"
);

function findJsonFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findJsonFiles(filePath, fileList);
    } else if (filePath.endsWith(".json")) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

function aggregateConfigs() {
  console.log("Aggregating OpenTelemetry configurations with instrumentation mapping...");
  const jsonFiles = findJsonFiles(INSTRUMENTATIONS_DIR);
  const allConfigs = new Map();

  jsonFiles.forEach((filePath) => {
    try {
      const pathParts = filePath.split(path.sep);
      const instrumentationName = pathParts[pathParts.length - 2];

      const fileData = JSON.parse(fs.readFileSync(filePath, "utf8"));

      if (fileData.configurations && Array.isArray(fileData.configurations)) {
        fileData.configurations.forEach((config) => {
          if (config.name) {
            if (!allConfigs.has(config.name)) {
              allConfigs.set(config.name, {
                ...config,
                instrumentations: [instrumentationName],
              });
            } else {
              const existing = allConfigs.get(config.name);
              if (!existing.instrumentations.includes(instrumentationName)) {
                existing.instrumentations.push(instrumentationName);
              }
            }
          }
        });
      }
    } catch (err) {
      console.error(`Error parsing ${filePath}:`, err);
    }
  });

  const finalArray = Array.from(allConfigs.values()).sort((a, b) => a.name.localeCompare(b.name));

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalArray, null, 2));
  console.log(
    `Successfully aggregated ${finalArray.length} configurations into global-configurations.json`
  );
}

aggregateConfigs();
