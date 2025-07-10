# Rational

The [Planning London Datahub][PLD] contains aggregated planning data from each Planning Authority in London.

As of July 2025, the  API is a (limited subset of) Elastic Search 7.x, but only provides access to the latest snapshot of the data.

Although the schema includes dates of key decisions, it's not possible to see historic changes to the data - for example, you can't see when the `decision` field changed.

This project is intended to overcome that by having a regularly updated 'mirror' of the dataset that is versioned via `git`. 

# Code

The code is hacker quality at best. It requires a version of NodeJS that supports TypeScript.

It can be found in `src/`


# Data

Captured data is stored `applications/` 

Each document is named after it `id` property. 

'id's is of the format `<lpaname>_<ref>`. The folder names are `lpa_name` and then subfolders for the first five digits of the `ref` value. This is to avoid having very large folders which have been known to cause problems.

If you intended to use this data for research, be aware that many fields contain values outside of the documented range. Cleansing is outside the scope of this project.

# Changesets

The early dataset commits contain changes that don't affect the data. For example, the raw Data Hub data may reorder fields. Similarly, the 'last_updated' and 'last_synced' fields may change without any other fields being changed.

To keep changesets more managable, and hopefully highlight relevant changes, the data is compared semantically, and changes are only committed when data has meaningfully changed. see #1 for some background.

If you require changesets for the 'last_updated' and 'last_synced' fields, this repository may prove a useful starting point.

[PLD]: https://www.london.gov.uk/programmes-strategies/planning/digital-planning/planning-london-datahub?ac-60574=60566
