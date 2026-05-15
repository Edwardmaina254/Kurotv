const consumet = require('@consumet/extensions');
const anilist = new consumet.META.Anilist();

async function test() {
  try {
    console.log("Fetching sources for 186497 episode 1...");
    // anilist uses the anilist ID
    const info = await anilist.fetchAnimeInfo("186497");
    console.log("Episodes:", info.episodes.length);
    if (info.episodes.length > 0) {
      const epId = info.episodes[0].id;
      console.log("Fetching sources for epId:", epId);
      const sources = await anilist.fetchEpisodeSources(epId);
      console.log("Sources:", JSON.stringify(sources, null, 2));
    }
  } catch(e) {
    console.error("Error:", e);
  }
}
test();
