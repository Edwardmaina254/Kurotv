// src/services/consumet.ts

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3005';
const CONSUMET_URL = `${API_BASE}/anime/zoro`;

export interface AnimeResult {
  id: string;
  title: string;
  url: string;
  image: string;         // High-res poster for cards
  bannerImage?: string;  // Ultra high-res for Hero Banner
  releaseDate?: string;
  subOrDub?: string;
}

export interface AnimeDetails extends AnimeResult {
  genres: string[];
  description: string;
  status: string;
  totalEpisodes: number;
  episodes: Episode[];
}

export interface Episode {
  id: string;
  number: number;
  url: string;
}

export interface StreamSource {
  url: string;
  isM3U8: boolean;
  quality: string;
}

export const consumetApi = {
  async getTopTrending(page: number = 1): Promise<AnimeResult[]> {
    try {
      const response = await fetch(`${CONSUMET_URL}/top-airing?page=${page}`);
      if (!response.ok) throw new Error(`Failed: ${response.status}`);

      const data = await response.json();

      return (data.results || []).map((anime: any) => ({
        ...anime,
        image: anime.image?.extraLarge || anime.image?.large || anime.image,
        bannerImage: anime.bannerImage || anime.image?.extraLarge || anime.image,
        title: typeof anime.title === 'object'
          ? (anime.title.english || anime.title.romaji || "Unknown Title")
          : anime.title
      }));
    } catch (error) {
      console.error("Consumet API Error (Trending):", error);
      return [];
    }
  },

  async getAiringSchedule(page: number = 1): Promise<AnimeResult[]> {
    try {
      const response = await fetch(`${CONSUMET_URL}/recent-episodes?page=${page}`);
      if (!response.ok) throw new Error(`Failed: ${response.status}`);
      const data = await response.json();
      return (data.results || []).map((anime: any) => ({
        ...anime,
        image: anime.image?.extraLarge || anime.image?.large || anime.image,
        bannerImage: anime.bannerImage || anime.image?.extraLarge || anime.image,
        title: typeof anime.title === 'object'
          ? (anime.title.english || anime.title.romaji || "Unknown Title")
          : anime.title
      }));
    } catch (error) {
      console.error("Consumet API Error (Schedule):", error);
      return [];
    }
  },

  async searchAnime(query: string, page: number = 1): Promise<AnimeResult[]> {
    try {
      const response = await fetch(`${CONSUMET_URL}/${encodeURIComponent(query)}?page=${page}`);
      if (!response.ok) throw new Error(`Failed: ${response.status}`);

      const data = await response.json();
      return (data.results || []).map((anime: any) => ({
        ...anime,
        image: anime.image?.extraLarge || anime.image?.large || anime.image,
        bannerImage: anime.bannerImage || anime.image?.extraLarge || anime.image,
        title: typeof anime.title === 'object'
          ? (anime.title.english || anime.title.romaji || "Unknown Title")
          : anime.title
      }));
    } catch (error) {
      console.error("Consumet API Error (Search):", error);
      return [];
    }
  },

  async getAnimeInfo(animeId: string): Promise<AnimeDetails | null> {
    try {
      // Now this hits our instant GraphQL route
      const response = await fetch(`${CONSUMET_URL}/info/${animeId}`);
      if (!response.ok) throw new Error(`Failed: ${response.status}`);

      const data = await response.json();
      if (data && typeof data.title === 'object') {
        data.title = data.title.english || data.title.romaji;
      }
      return data as AnimeDetails;
    } catch (error) {
      console.error("Consumet API Error (Info):", error);
      return null;
    }
  },

  // NEW METHOD: Fetches the episodes separately in the background
  async getAnimeEpisodes(animeId: string): Promise<Episode[]> {
    try {
      const response = await fetch(`${CONSUMET_URL}/episodes/${animeId}`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.episodes || [];
    } catch (error) {
      console.error("Consumet API Error (Episodes):", error);
      return [];
    }
  },

  async getStreamingLinks(episodeId: string): Promise<StreamSource[]> {
    try {
      const response = await fetch(`${CONSUMET_URL}/watch/${episodeId}`);
      if (!response.ok) throw new Error(`Failed: ${response.status}`);

      const data = await response.json();
      return data.sources || [];
    } catch (error) {
      console.error("Consumet API Error (Stream Links):", error);
      return [];
    }
  }
};