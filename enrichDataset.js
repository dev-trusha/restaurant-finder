// enrichDataset.js
const fs = require("fs");
const csv = require("csvtojson");

// Utility: generate random amenities
function randomAmenities() {
  const options = [
    "WiFi",
    "Outdoor Seating",
    "Pet Friendly",
    "Live Music",
    "Wine Selection",
    "Charging Ports",
    "Gluten-Free Options"
  ];
  // Pick 2–4 random amenities
  return options.sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 3) + 2);
}

// Utility: random boolean
function randomBoolean() {
  return Math.random() < 0.5;
}

// Utility: placeholder image URL
function randomImage(name) {
  const safeName = name.replace(/\s+/g, "-").toLowerCase();
  return `https://picsum.photos/seed/${safeName}/400/300`;
}

csv()
  .fromFile("Dataset.csv") // Input CSV file
  .then((jsonArray) => {
    const enriched = jsonArray.map((row) => ({
    name: row["Restaurant Name"],
    rating: parseFloat(row["Aggregate rating"]),
    address: {
        street: row["Address"],
        city: row["City"],
        country: row["Country Code"] === "162" ? "Botswana" : "Unknown"
    },
    cuisines: row["Cuisines"] ? row["Cuisines"].split(",").map(c => c.trim()) : [],
    amenities: randomAmenities(),
    hasWifi: row["Has Table booking"] === "Yes",
    image: randomImage(row["Restaurant Name"]),
    location: `${row["City"]}, ${row["Country Code"]}`,
    geo: {
        lat: parseFloat(row["Latitude"]),
        lng: parseFloat(row["Longitude"])
    },
    reviews: [
        {
        userId: `u${row["Restaurant ID"]}`,
        stars: Math.floor(Math.random() * 5) + 1,
        text: row["Rating text"],
        date: new Date().toISOString()
        }
    ],
    priceRange: row["Price range"],
    averageCostForTwo: parseInt(row["Average Cost for two"]),
    currency: row["Currency"],
    votes: parseInt(row["Votes"])
    }));

    fs.writeFileSync("restaurants_enriched.json", JSON.stringify(enriched, null, 2));
    console.log("✅ Enriched dataset saved to restaurants_enriched.json");
  })
  .catch((err) => console.error("Error processing CSV:", err));

