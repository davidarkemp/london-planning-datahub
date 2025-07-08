import path from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import { rateLimit } from "./rate-limit.ts";
import lastUpdated from "./last-updated.ts";

type RetrievalBucket = { start: number, max?: number, count: number, real_bucket_count: number, filters: unknown[] };
function newBucket(start: number, initial_count: number): RetrievalBucket {
    return { start, count: initial_count, real_bucket_count: 0, filters: [] }
}

const max_bucket_size = 500;
const default_filters = [
    { range: { last_updated: { 'gte': lastUpdated } } }
];

async function calculate_download_buckets(default_filters: unknown[]) {
    const blocks = await fetch("https://planningdata.london.gov.uk/api-guest/applications/_search", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accepts": "application/json"
        },
        body: JSON.stringify({
            size: 0,
            aggs: {
                "centroid_easting": {
                    histogram: {
                        field: "centroid_easting",
                        interval: "100",
                        "min_doc_count": 1
                    }
                },
                
            },
            query: {
                bool: {
                    filter: default_filters
                }
            }
        })
    });

    var aggs = await blocks.json();


    let current_bucket: RetrievalBucket | undefined;



    const buckets: Array<RetrievalBucket> = [];
    /** @var { { key: number, doc_count: number } } real_bucket */
    for (let real_bucket of aggs.aggregations["centroid_easting"].buckets) {
        current_bucket ??= newBucket(real_bucket.key, real_bucket.doc_count);
        if (current_bucket.count + real_bucket.doc_count > max_bucket_size) {
            current_bucket.max = real_bucket.key;
            buckets.push(current_bucket);
            current_bucket = newBucket(real_bucket.key, real_bucket.doc_count);
        } else {
            current_bucket.count += real_bucket.doc_count;
        }

        current_bucket.real_bucket_count += 1;
    }
    if (current_bucket) buckets.push(current_bucket);

    buckets.forEach(function (bucket) {
        
        return bucket.filters.push({
            range: {
                "centroid_easting": bucket.max === undefined ? {
                    gte: bucket.start,
                } : {
                    gte: bucket.start,
                    lt: bucket.max
                }
            }
        });
    });

    console.dir(buckets.sort((a, b) => a.start - b.start));
    return buckets;
}

async function get_bucket_contents(bucket: RetrievalBucket) {
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
                        ...bucket.filters,
                        ...default_filters
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
    process.stdout.write(`${bucket.start}: ${hits.hits.hits.length}` + "               \n");
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


const buckets = await calculate_download_buckets(default_filters);

await Promise.allSettled(buckets.map(rateLimit(download_bucket, 20)))

process.stdout.write("\n");

const date = new Date();

await writeFile('src/last-updated.ts', "export default `" + new Date(date.getFullYear(), date.getMonth(), date.getDate()).toJSON() + "`;")

