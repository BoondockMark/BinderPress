# BinderPress on Windows

Use Command Prompt for the commands below. BinderPress runs on your computer;
keep its terminal open while you use the editor in your browser.

## Install and open

Install Git from https://git-scm.com/downloads and Node.js 22.12 or newer from
https://nodejs.org/. Node includes npm. Open a new Command Prompt after installing
them. Check the versions:

```bat
node --version
npm --version
git --version
```

In the folder where you keep projects, run:

```bat
git clone https://github.com/BoondockMark/BinderPress.git
cd BinderPress
npm ci
npm start
```

The first install downloads the PDF browser. Then open
http://127.0.0.1:4174. You should see a welcome screen with three choices:
Try the sample, Create a binder, and Open an existing binder.

The welcome screen's **Check this computer's setup** button checks Node, the PDF
browser executable, and the suggested folder. Git and GitHub CLI are listed as
optional tools for version history and pull requests. Checks do not sign you in,
install software, or publish anything.

## Make your first page

1. Choose **Create a binder**.
2. Enter a name and optional organization. Choose a new folder outside the
   BinderPress application. Use Browse to choose its parent folder if needed.
3. Keep the suggested sections or change them, then choose **Create and open binder**.
4. Edit the first draft and choose **Save**.
5. Choose **Build PDF proof**, wait for it to finish, then **Download PDF**.

Your browser saves the downloaded proof in its normal download location. A
command-line binder build writes publication PDFs to `docs\pdfs\` and page
images to `docs\previews\` inside the binder content folder. Drafts still need
review before approval or publication.

**Change binder** returns to the welcome screen. The editor identifies the open
binder and its folder. Your content is separate from the application.

## Stop and reopen

Press **Ctrl+C** in the terminal to stop BinderPress. To start it another day,
open Command Prompt in your BinderPress application folder and run:

```bat
npm start
```

Choose **Open an existing binder**, then select your content folder. You do not
need to run `npm ci` on every start.

## Common setup problems

| What you see | What to do |
|---|---|
| `node` or `npm` is not recognized | Install Node, then open a new Command Prompt. |
| `git` is not recognized | Install Git, then open a new Command Prompt. Git is needed to clone this repository. |
| A missing Chrome/browser message | From the application folder, run `npx puppeteer browsers install chrome`, then check setup again. The browser download needs an internet connection. |
| An unavailable custom browser | Check `PUPPETEER_EXECUTABLE_PATH`. In Command Prompt, `set PUPPETEER_EXECUTABLE_PATH=` clears it for that terminal. Restart BinderPress from the same terminal. |
| Port 4174 is already in use | Open the existing local page, or stop the other BinderPress terminal with Ctrl+C before restarting. |
| A folder cannot be created | Choose an existing parent folder you can write to, and a new binder folder name. Existing folders are never overwritten. |
| A missing private checkout | Leave **Include linked private pages** off to open public pages. For private mode, correct `BINDER_PRIVATE_DIR` or the binder's `.binder-local.json` link. Relative private paths start from the content folder. |
| An older clone opens the sample with a private-path error | Run `npm run editor:public`. `set BINDER_PRIVATE_DIR=` clears an inherited private path for the current Command Prompt. |
| GitHub login works but Git actions still fail | Run `gh auth status` and `gh auth setup-git`. `GH_TOKEN` and `GITHUB_TOKEN` override saved credentials; check the environment used to start the editor. |

These `set NAME=` commands affect the current Command Prompt only. In PowerShell,
the equivalent is `Remove-Item Env:NAME -ErrorAction SilentlyContinue`.

## GitHub is optional

Local writing, saving, and PDF proofs work without a GitHub account. If you want
Save & PR later, install GitHub CLI from https://cli.github.com/ and run:

```bat
gh auth login
gh auth setup-git
```

Your content folder must also be its own Git checkout, have your Git name/email
configured, and have an origin pointing to the intended GitHub repository with
write access. The Save & PR dialog explains these requirements. Private pages
require a private repository. These setup checks do not create repositories or
change sharing settings.

## Update the application

Stop the editor. From the application checkout, first review `git status` so
local changes are accounted for. With a clean checkout of main:

```bat
git switch main
git pull --ff-only
npm ci
npm start
```

Use the dependency versions in the committed lockfile. If an audit reports an
issue, check for an application update before changing dependencies independently:
browser upgrades can change PDF output. Linux CI remains the release-artifact
environment; Windows builds validate local compatibility.
