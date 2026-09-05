const { MongoClient } = require("mongodb");

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("MONGODB_URI is not configured.");
}

async function main() {
  const client = new MongoClient(uri);

  try {
    await client.connect();

    const db = client.db("mangosta");
    const collection = db.collection("products");

    const products = await collection.find({
      "images": {
        $elemMatch: {
          $regex: "picsum\\.photos",
          $options: "i",
        },
      },
    }).toArray();

    console.log(`Found ${products.length} products containing Picsum images.`);

    if (products.length === 0) {
      console.log("No Picsum images found.");
      return;
    }

    const result = await collection.updateMany(
      {
        "images": {
          $elemMatch: {
            $regex: "picsum\\.photos",
            $options: "i",
          },
        },
      },
      [
        {
          $set: {
            images: {
              $filter: {
                input: "$images",
                as: "image",
                cond: {
                  $not: [
                    {
                      $regexMatch: {
                        input: "$$image",
                        regex: "picsum\\.photos",
                        options: "i",
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      ]
    );

    console.log(`Matched: ${result.matchedCount}`);
    console.log(`Modified: ${result.modifiedCount}`);
    console.log("All Picsum image URLs have been removed.");
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});