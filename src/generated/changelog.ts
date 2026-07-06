type ChangelogEntry = {
  version: string;
  title: string;
  date: string;
  summary: string;
  notes: string[];
};

type ChangelogData = {
  schemaVersion: 2;
  packageVersion: string;
  entries: ChangelogEntry[];
};

const changelog: ChangelogData = {
  "schemaVersion": 2,
  "packageVersion": "0.1.0",
  "entries": []
};

export default changelog;
