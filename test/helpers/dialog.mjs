export async function respondToDialog(page, response, action) {
  let listener, timer;
  const handled = new Promise((resolve, reject) => {
    listener = dialog => dialog[response]().then(resolve, reject);
    page.once('dialog', listener);
    timer = setTimeout(() => reject(Error(`Expected browser dialog to ${response}`)), 15000);
  });
  try { await Promise.all([action(), handled]); }
  finally { clearTimeout(timer); page.off('dialog', listener); }
}
