import path from "node:path";
import { writeFile, mkdir, default as fs } from "node:fs/promises";
import lastUpdated from "./last-updated.ts";
import objectHash from 'object-hash';

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
        console.debug(`${JSON.stringify(query)}: ${hits.length}`);
        if(hits.length == 0) return;
        
        yield hits;

        query['search_after'] = hits[hits.length-1]["sort"];
    } while(true)
}

const writers: Array<Promise<void>> = [];

async function file_exists(path) {
    try { 
        const stat = await fs.stat(path);
        return stat.isFile();
    } catch(error) {
        return false;
    }
}

async function write_document(hit) {
/** @var { string } valid_date */
    /** @var { string! } id */
    const { _id: id } = hit;

    const [start, parts] = id.split('-')
    const other_paths = parts.split('').slice(0, 5);
    let folder = path.join(start, ...other_paths);

    folder = path.join("applications", folder);
    const file = path.join(folder, id + '.json');

    if(await file_exists(file)) {
        const contents = await fs.readFile(file);
        let { last_updated: _last_updated, ...existing } = JSON.parse(contents.toString());
        let { last_updated: _1, last_synced: _2, ...updated } = hit._source;

        if(objectHash(existing) === objectHash(updated)) {
            return;
        }
    }

    await mkdir(folder, { recursive: true });

    const { last_synced: _last_synced, ...data } = hit._source;
    await writeFile(file, JSON.stringify(data, undefined, 2));
}

async function write_documents(hits) {
    const sort = hits[hits.length-1].sort;
    const promised = hits.map(write_document);
    hits = null;
    await Promise.allSettled(promised);
}

for await (let hits of get_document_chunks(default_filters)) {
    writers.push(write_documents(hits));
}

process.stdout.write("\n");

await Promise.allSettled(writers);

const date = new Date();

await writeFile('src/last-updated.ts', "export default `" + new Date(date.getFullYear(), date.getMonth(), date.getDate()).toJSON() + "`;")

