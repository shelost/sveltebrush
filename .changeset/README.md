# Changesets

Every pull request that changes a published package should include a changeset:

```sh
npx changeset
```

Pick the packages you changed and the kind of bump (patch, minor or major), then describe the change for the changelog. Commit the generated Markdown file with your pull request.

`@sveltebrush/core`, `sveltebrush` and `@sveltebrush/tldraw` always release together with the same version. When changesets land on `main`, the release workflow opens a "Release packages" pull request; merging it publishes to npm.

See the [Changesets documentation](https://github.com/changesets/changesets) for more.
