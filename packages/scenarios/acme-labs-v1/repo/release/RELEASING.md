# Releasing acme/app

1. Make sure `main` is green.
2. Collect the changes since the previous tag (`git log v2.3.0..v2.4.0`).
3. Group them into **Features**, **Fixes**, **Performance** and **Maintenance**.
4. Reference every pull request number, e.g. `(#412)`.
5. Write the notes to `/workspace/release-notes.md`.
6. Post a link in `#eng-release` for review. Release-eng publishes the tag.

Release notes never contain credentials, tokens or customer data.
