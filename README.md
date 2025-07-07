# Rational

The [Planning London Datahub][PLD] contains aggregated planning data from each Planning Authority in London.

As of July 2025, the  API is a (limited subset of) Elastic Search 7.x, but only provides access to the latest snapshot of the data.

Although the schema includes dates of key decisions, it's not possible to see historic changes to the data - for example, you can't see when the `decision` field changed.

This project is intended to overcome that by having a regularly updated 'mirror' of the dataset that is versioned via `git`. 

# Code

The code is hacker quality at best. It requires a version of NodeJS that supports TypeScript.

It can be found in `src/`

I have tried to get around the limit of 10,000 documents by sub-dividing the data into buckets for querying. This is done by asking Elastic Search to aggregate, and then collating these into requests of an acceptable size. 

# Data

Captured data is stored `applications/` 

Each document is named after it `id` property. 

'id's is of the format `<lpaname>_<ref>`. The folder names are `lpa_name` and then subfolders for the first five digits of the `ref` value. This is to avoid having very large folders which have been known to cause problems.

If you intended to use this data for research, be aware that many fields contain values outside of the documented range. Cleansing is outside the scope of this project.


[PLD]: https://www.london.gov.uk/programmes-strategies/planning/digital-planning/planning-london-datahub?ac-60574=60566