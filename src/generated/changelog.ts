const changelog = {
  "schemaVersion": 1,
  "packageVersion": "0.1.0",
  "entries": [
    {
      "version": "Next",
      "title": "Next release",
      "date": "2026-06-18",
      "summary": "Changes queued after v0.1.0. This section refreshes from commit history when the site is built.",
      "groups": [
        {
          "category": "Improvements",
          "items": [
            "Refresh providers and marketing site",
            "Redesign TokenMaxxer marketing page",
            "Polish marketing site and changelog"
          ]
        },
        {
          "category": "Packaging",
          "items": [
            "Add Tauri updater support"
          ]
        },
        {
          "category": "Docs",
          "items": [
            "Add MIT license metadata"
          ]
        }
      ]
    },
    {
      "version": "0.1.0",
      "title": "TokenMaxxer 0.1.0",
      "date": "2026-06-16",
      "summary": "TokenMaxxer 0.1.0 release notes generated from repository history.",
      "groups": [
        {
          "category": "Packaging",
          "items": [
            "Prepare TokenMaxxer release",
            "Improve release readiness",
            "Add macOS bundle icon",
            "Wire release download links"
          ]
        },
        {
          "category": "Changes",
          "items": [
            "Initial TokenMaxxer repository"
          ]
        }
      ]
    }
  ]
} as const;

export default changelog;
