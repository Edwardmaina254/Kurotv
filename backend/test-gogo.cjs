const consumet = require('@consumet/extensions');
const hianime = new consumet.ANIME.Hianime();

async function test() {
  try {
    console.log("Searching for 'Ramparts of Ice' on Hianime...");
    const searchResults = await hianime.search("Koori no Jouheki");
    console.log("Search Results:", searchResults.results.map(r => r.id));
    
    if (searchResults.results.length > 0) {
      const gogoId = searchResults.results[0].id;
      console.log("Fetching info for:", gogoId);
      const info = await hianime.fetchAnimeInfo(gogoId);
      
      if (info.episodes.length > 0) {
        const epId = info.episodes[0].id;
        console.log("Fetching sources for episode:", epId);
        const sources = await hianime.fetchEpisodeSources(epId);
        console.log("Sources found:", sources.sources.length);
        console.log(sources.sources);
      } else {
        console.log("No episodes found.");
      }
    } else {
      console.log("Anime not found on Hianime.");
    }
  } catch(e) {
    console.error("Error:", e.message);
  }
}
test();
