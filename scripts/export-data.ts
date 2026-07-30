/**
 * Dumps every DynamoDB table this project uses into plain JSON files.
 * Not tied to any AWS-specific format - the output is just arrays of
 * plain objects, so it can be imported into any other database if this
 * AWS account ever needs to be retired.
 *
 * Run with: node --experimental-strip-types scripts/export-data.ts
 * (requires local AWS credentials, e.g. `aws login`)
 */
import { mkdir, writeFile } from "node:fs/promises";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const REGION = "ap-northeast-1";
const TABLES = ["ptt-articles", "ptt-subscriptions", "ptt-rate-limits", "ptt-page-views"];
const OUTPUT_DIR = new URL("../backups/", import.meta.url);

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

async function scanAll(tableName: string) {
  const items: Record<string, unknown>[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;

  do {
    const result = await ddb.send(new ScanCommand({ TableName: tableName, ExclusiveStartKey }));
    items.push(...(result.Items ?? []));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  return items;
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  for (const table of TABLES) {
    const items = await scanAll(table);
    const file = new URL(`${table}.${timestamp}.json`, OUTPUT_DIR);
    await writeFile(file, JSON.stringify(items, null, 2));
    console.log(`${table}: ${items.length} items -> ${file.pathname}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
