export interface Room {
  id: string;
  name: string;
  type: "beachfront" | "ocean-view" | "garden" | "diving-suite";
  price: number;
  capacity: number;
  size: number;
  description: string;
  amenities: string[];
  images: string[];
  available: boolean;
  rating: number;
  reviews: number;
}

export interface Service {
  id: string;
  name: string;
  category: "diving" | "snorkeling" | "water-sports" | "island" | "wellness";
  price: number;
  duration: string;
  description: string;
  image: string;
  available: boolean;
  schedule: string[];
  maxParticipants: number;
  difficulty?: string;
}

export interface Review {
  id: string;
  guestName: string;
  guestAvatar: string;
  rating: number;
  comment: string;
  date: string;
  roomName?: string;
  serviceName?: string;
}

export const rooms: Room[] = [];

export const services: Service[] = [];

export const sampleReviews: Review[] = [];
