import path from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import type { PathLike } from "node:fs";
import { rateLimit } from "./rate-limit.ts";
import { start } from "node:repl";

const blocks = await fetch("https://planningdata.london.gov.uk/api-guest/applications/_search", {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Accepts": "application/json"
    },
    body: JSON.stringify({
        size: 0,
        aggs: {
            eastings: {
                histogram: {
                    field: "centroid_easting",
                    interval: "100",
                    "min_doc_count": 1
                }
            }
        }
    })
});

var aggs = await blocks.json();

type RetrievalBucket = { start: number, max?: number, count: number, real_bucket_count: number };
const max_bucket_size = 500;
let current_bucket: RetrievalBucket | undefined;
const buckets: Array<RetrievalBucket> = [];
/** @var { { key: number, doc_count: number } } real_bucket */
for (let real_bucket of aggs.aggregations.eastings.buckets) {
    current_bucket ??= { start: real_bucket.key, count: real_bucket.doc_count, real_bucket_count: 0 };
    if (current_bucket.count + real_bucket.doc_count > max_bucket_size) {
        current_bucket.max = real_bucket.key;
        buckets.push(current_bucket);
        current_bucket = { start: real_bucket.key, count: real_bucket.doc_count, real_bucket_count: 0 }
    } else {
        current_bucket.count += real_bucket.doc_count;
    }

    current_bucket.real_bucket_count += 1;
}
if (current_bucket) buckets.push(current_bucket);

console.dir(buckets.sort((a, b) => a.start - b.start));

async function get_bucket_contents(bucket)  {
    console.debug("Download bucket from %d", bucket.start);
    return await fetch("https://planningdata.london.gov.uk/api-guest/applications/_search", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accepts": "application/json"
        },
        body: JSON.stringify({
            size: 10000,

            query: {
                bool: {
                    filter: [
                        {
                            range: {
                                centroid_easting: {
                                    gte: bucket.start,
                                    lt: bucket.max
                                }
                            }
                        }
                    ]
                }
            }

        })
    });
};

const get_bucket_contents_rate_limited = rateLimit(get_bucket_contents, 10);

async function download_bucket(bucket) {
    //process.stdout.write(bucket.start + "               \r");
    
    const response = await get_bucket_contents_rate_limited(bucket);
    if (!response.ok) {
        console.error("\nError getting %o", bucket)
        console.error(await response.text())
        process.exit(1);
    }

    const hits = await response.json();
    process.stdout.write(`${bucket.start} : ${hits.hits.hits.length}` + "               \n");
    for (let hit of hits.hits.hits) {

        /** @var { string } valid_date */
        /** @var { string! } id */
        const { _id: id, _source: { valid_date, lpa_name } } = hit;

        const [start, parts] = id.split('-')
        const other_paths = parts.split('').slice(0, 5);
        let folder = path.join(start, ...other_paths);
        
        folder = path.join("applications", folder);

        await mkdir(folder, { recursive: true });

        const { last_synced: _last_synced, ...data } = hit._source;
        await writeFile(path.join(folder, id + '.json'), JSON.stringify(data, undefined, 2));
    }
}

await Promise.allSettled(buckets.map(rateLimit(download_bucket, 20)))

process.stdout.write("\n");