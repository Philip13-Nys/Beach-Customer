import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { rooms, Room } from "../data/mockData";
import { Star, Users, Maximize2, Filter, X, Search } from "lucide-react";

const CATEGORIES = [
  "All",
  "Beachfront",
  "Ocean View",
  "Garden",
  "Diving Suite",
];

export default function Rooms() {
  const [params] = useSearchParams();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [maxPrice, setMaxPrice] = useState(15000);
  const [minCapacity, setMinCapacity] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);

  const guestsParam = params.get("guests")
    ? parseInt(params.get("guests")!)
    : 1;

  const filtered = rooms.filter((r) => {
    const matchSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.description.toLowerCase().includes(search.toLowerCase());
    const matchCat =
      category === "All" || r.type.replace("-", " ") === category.toLowerCase();
    const matchPrice = r.price <= maxPrice;
    const matchCap = r.capacity >= Math.max(minCapacity, guestsParam);
    return matchSearch && matchCat && matchPrice && matchCap;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "2.25rem",
            fontWeight: 700,
            color: "#0A2540",
          }}
        >
          Our Accommodations
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {filtered.length} room{filtered.length !== 1 ? "s" : ""} available ·
          Busuanga, Palawan
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Filters sidebar */}
        <aside className="lg:w-64 flex-shrink-0">
          {/* Mobile filter toggle */}
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className="lg:hidden w-full flex items-center justify-between px-4 py-3 bg-white border border-border rounded-xl text-sm font-medium mb-4"
          >
            <span className="flex items-center gap-2">
              <Filter className="w-4 h-4" /> Filters
            </span>
            {filterOpen ? <X className="w-4 h-4" /> : null}
          </button>

          <div
            className={`${filterOpen ? "block" : "hidden"} lg:block bg-white rounded-2xl border border-border p-5 space-y-6`}
          >
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Room name or feature..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                Room Type
              </label>
              <div className="space-y-1.5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      category === cat
                        ? "bg-secondary text-primary font-medium"
                        : "text-foreground hover:bg-muted"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                Max Price: ₱{maxPrice.toLocaleString()}/night
              </label>
              <input
                type="range"
                min={3000}
                max={15000}
                step={500}
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>₱3,000</span>
                <span>₱15,000</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                Min. Capacity: {minCapacity} guest{minCapacity > 1 ? "s" : ""}
              </label>
              <input
                type="range"
                min={1}
                max={6}
                value={minCapacity}
                onChange={(e) => setMinCapacity(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>1</span>
                <span>6</span>
              </div>
            </div>

            <button
              onClick={() => {
                setSearch("");
                setCategory("All");
                setMaxPrice(15000);
                setMinCapacity(1);
              }}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors underline"
            >
              Clear all filters
            </button>
          </div>
        </aside>

        {/* Room grid */}
        <div className="flex-1">
          {filtered.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <div className="text-4xl mb-3">🏖️</div>
              <p className="font-medium text-foreground">
                No rooms match your filters
              </p>
              <p className="text-sm mt-1">Try adjusting your search criteria</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filtered.map((room) => (
                <RoomCard key={room.id} room={room} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RoomCard({ room }: { room: Room }) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-border shadow-sm hover:shadow-lg transition-all duration-300 group">
      <div className="relative h-52 overflow-hidden">
        <img
          src={room.images[0]}
          alt={room.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute top-3 left-3 flex gap-2">
          <span className="px-2.5 py-1 bg-white/95 rounded-full text-xs font-medium text-primary capitalize">
            {room.type.replace("-", " ")}
          </span>
          {!room.available && (
            <span className="px-2.5 py-1 bg-red-100 text-red-600 rounded-full text-xs font-medium">
              Unavailable
            </span>
          )}
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3
            className="font-semibold text-foreground leading-tight"
            style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem" }}
          >
            {room.name}
          </h3>
        </div>

        <div className="flex items-center gap-3 mb-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
            {room.rating} ({room.reviews} reviews)
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> Up to {room.capacity}
          </span>
          <span className="flex items-center gap-1">
            <Maximize2 className="w-3.5 h-3.5" /> {room.size} m²
          </span>
        </div>

        <p className="text-muted-foreground text-xs leading-relaxed mb-4 line-clamp-2">
          {room.description}
        </p>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {room.amenities.slice(0, 4).map((a) => (
            <span
              key={a}
              className="px-2 py-0.5 bg-secondary text-primary text-[10px] rounded-full"
            >
              {a}
            </span>
          ))}
          {room.amenities.length > 4 && (
            <span className="px-2 py-0.5 bg-muted text-muted-foreground text-[10px] rounded-full">
              +{room.amenities.length - 4} more
            </span>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-border">
          <div>
            <span className="text-accent font-bold text-xl">
              ₱{room.price.toLocaleString()}
            </span>
            <span className="text-muted-foreground text-xs">/night</span>
          </div>
          <Link
            to={`/rooms/${room.id}`}
            className={`text-sm font-medium px-4 py-2 rounded-xl transition-colors ${
              room.available
                ? "bg-primary text-white hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
            onClick={(e) => !room.available && e.preventDefault()}
          >
            {room.available ? "View Details" : "Unavailable"}
          </Link>
        </div>
      </div>
    </div>
  );
}
