export function imageFilename(url: string) {
  try {
    const path = new URL(url).pathname.split("/").at(-1) ?? "";
    let filename = decodeURIComponent(path);
    // Imported Webflow assets can carry several IDs and nested URL encoding.
    // Display only: never use this label to compare or rewrite source URLs.
    for (let pass = 0; pass < 3 && /%[a-f0-9]{2}/i.test(filename); pass++) {
      try {
        const decoded = decodeURIComponent(filename);
        if (decoded === filename) break;
        filename = decoded;
      } catch { break; }
    }
    filename = filename.replace(/^(?:[a-f0-9]{24}_)+/i, "");
    return filename || "Image";
  } catch { return "Image"; }
}
