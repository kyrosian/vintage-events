# Vintage Events

A standalone website for short Old School RuneScape clan events. It includes individual and team competitions, winners, optional prize pools, all-time win leaderboards, and past-event attendance. The parchment theme and supplied RuneScape font are included.

## Publish on your own GitHub account

1. Extract `Vintage_Events_GitHub.zip` on your computer. Open the extracted folder so you can see `index.html`, the JavaScript files, and the `fonts` folder.
2. Sign into [GitHub](https://github.com/new) and create a repository named `vintage-events`. Choose **Public**, turn **Add README** on, then click **Create repository**. Public repositories can use GitHub Pages on GitHub Free. This creates a public website.
3. In your repository, choose **Add file → Upload files**. Drag all the extracted files, including `.nojekyll` and the `fonts` folder, into the upload area. Upload the contents, not the ZIP or the enclosing folder. Commit the upload directly to the `main` branch. The included README can replace the initial README.
4. Check that `index.html` is visible at the top level of your repository. The font should be inside `fonts/runescape_uf.ttf`.
5. Open **Settings → Pages**. Under **Build and deployment**, set Source to **Deploy from a branch**, Branch to **main**, and Folder to **/ (root)**, then click **Save**.
6. Allow up to ten minutes, then return to **Settings → Pages** and click **Visit site**. The address will have the form `https://YOUR-USERNAME.github.io/vintage-events/`. Share that address with your clan.

GitHub's instructions: [Create a Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site), [upload files](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository), and [configure the publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Manage your events

Your published Events and Results sheets are already connected. Continue editing those sheets and use **Refresh** on the website to load their latest published values. Google Sheets can take a little time to publish changes. There is no need to upload website files again when you edit scores or add an event.

- **Events:** set a permanent Event ID, event name, Individual or Teams format, status, start time, duration in minutes, scoring rules, and optional prize text.
- **Results:** add one row per player per event using the same Event ID. Enter team, score, and actual attendance (Yes or No). Blank attendance is unrecorded.
- Mark an event **Completed** to confirm its result. An empty Winner field selects the best recorded score according to Highest or Lowest; tied leaders share the win. To override this, enter the exact player or team name in Winner.
- A winning team and its members each receive a win; anyone marked absent is excluded.
- Keep completed event and result rows to retain the archive and all-time leaderboard. Use a new Event ID for each new event.
- Leave Prize pool blank to hide the prize section.

## Files and future changes

`index.html` contains the page structure. `osrs.css` controls the theme. `fonts/runescape_uf.ttf` is your supplied font. The `.js` files contain the existing event logic, with standard JavaScript filenames for this export. No npm install, build command, server, or Sites account is required to host these files.

`config.js` contains the two published CSV links. Edit that file only if you replace the spreadsheet or republish different tabs. `snapshot.json` is a labelled fallback copy of the event data captured when the sheet was connected; the app tries to load the live sheets whenever it opens or you press Refresh.

After a website code or design change, upload the changed files to the same repository and commit them to main. GitHub Pages will publish the update. The existing ChatGPT-hosted site and your GitHub copy are separate; changing one copy's code does not update the other. Both can read the same Google Sheets.

## If something looks wrong

- **404 page:** check that Pages uses main and / (root), and that index.html is at the repository root. Check the Actions tab for a failed Pages run.
- **Missing styling or font:** make sure osrs.css and the fonts folder were uploaded without renaming them, then reload the page.
- **Saved event data notice:** the live sheet request failed. Confirm both tabs are still published as CSV and press Refresh.
- **Winners are empty:** the event must be Completed and have recorded scores or a valid Winner name.
- **Opening index.html directly does not load data:** use the published GitHub Pages address; browsers restrict JavaScript modules on file:// pages.
