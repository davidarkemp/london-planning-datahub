import path from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import lastUpdated from "./last-updated.ts";

const default_filters = [
    { range: { last_updated: { 'gte': lastUpdated } } }
];

async function* get_document_chunks(filters: unknown[] = []) {
    let query: Record<string, unknown> = {
        size: 10_000,
        sort: { 'id': 'asc' },
         
    };

    if(filters && Array.isArray(filters) && filters.length) {
        query.query = {
            bool: {
                filter: filters
            }
        };
    }

    do {
        const response = await fetch('https://planningdata.london.gov.uk/api-guest/applications/_search',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(query)
            }
        );

        if(!response.ok) {
            throw new Error(`Http Error: ${response.status} - ${response.statusText}`);
        }

        const jsonResponse = await response.json();
        const hits = jsonResponse.hits.hits;
        console.log(`${JSON.stringify(query)}: ${hits.length}`);
        if(hits.length == 0) return;
        
        yield hits;

        query['search_after'] = hits[hits.length-1]["sort"];
    } while(true)
}

const writers: Array<Promise<void>> = [];

async function write_document(hit) {
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

async function write_documents(hits) {
    await Promise.allSettled(hits.map(write_document));
    hits = null;
}

for await (let hits of get_document_chunks(default_filters)) {
    writers.push(write_documents(hits));
}

process.stdout.write("\n");

await Promise.allSettled(writers);

const date = new Date();

await writeFile('src/last-updated.ts', "export default `" + new Date(date.getFullYear(), date.getMonth(), date.getDate()).toJSON() + "`;")

